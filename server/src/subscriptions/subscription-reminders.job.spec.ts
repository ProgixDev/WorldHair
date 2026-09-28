import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';
import { SupabaseService } from '../database/supabase.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../notifications/push.service';
import { PushTokensService } from '../notifications/push-tokens.service';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { SubscriptionRemindersJob } from './subscription-reminders.job';

const COIFFEUR_ID = 'coiffeur-1';
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

class FakePushService {
  send: PushService['send'] = async (messages) => messages.map((m) => ({ token: m.token, ok: true }));
}

function testConfig(): ConfigService<EnvironmentVariables, true> {
  const values: Record<string, unknown> = {
    MAIL_TRANSPORT: 'json',
    MAIL_HOST: '',
    MAIL_PORT: 587,
    MAIL_SECURE: false,
    MAIL_USER: '',
    MAIL_PASSWORD: '',
    MAIL_FROM: 'WorldHair <no-reply@worldhair.app>',
    WEB_APP_URL: 'https://worldhair.test',
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService<EnvironmentVariables, true>;
}

describe('SubscriptionRemindersJob', () => {
  let supabase: FakeSupabaseService;
  let mail: MailService;
  let job: SubscriptionRemindersJob;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    supabase.addUser('coiffeur-token', { id: COIFFEUR_ID, email: 'sofia@example.com', email_confirmed_at: null }, 'coiffeur');
    const pushTokens = new PushTokensService(supabase as unknown as SupabaseService);
    const notifications = new NotificationsService(
      supabase as unknown as SupabaseService,
      pushTokens,
      new FakePushService() as unknown as PushService,
    );
    mail = new MailService(testConfig());
    job = new SubscriptionRemindersJob(supabase as unknown as SupabaseService, notifications, mail);
  });

  it('warns a coiffeur a week before a scheduled end, once, by push and email', async () => {
    const sendEnding = jest.spyOn(mail, 'sendSubscriptionEndingSoonEmail');
    const endsAt = inDays(7);
    supabase.seedSubscription({
      profileId: COIFFEUR_ID,
      status: 'active',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      cancelAt: endsAt,
    });

    await job.run();
    await job.run();

    expect(supabase.notifyLogFor(COIFFEUR_ID).filter((n) => n.type === 'subscription_ending_soon')).toHaveLength(1);
    expect(sendEnding).toHaveBeenCalledTimes(1);
    expect(sendEnding).toHaveBeenCalledWith('sofia@example.com', endsAt);
  });

  it('does the same for an offered subscription running out', async () => {
    supabase.seedSubscription({ profileId: COIFFEUR_ID, status: 'active', currentPeriodEnd: inDays(7) });

    await job.run();

    expect(supabase.notifyLogFor(COIFFEUR_ID).map((n) => n.type)).toEqual(['subscription_ending_soon']);
  });

  it('leaves alone a subscription that renews on its own, or ends later', async () => {
    supabase.seedSubscription({
      profileId: COIFFEUR_ID,
      status: 'active',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      currentPeriodEnd: inDays(7),
    });
    supabase.seedSubscription({ profileId: 'coiffeur-2', status: 'active', stripeSubscriptionId: 'sub_2', cancelAt: inDays(20) });

    await job.run();

    expect(supabase.notifyLogFor(COIFFEUR_ID)).toEqual([]);
    expect(supabase.notifyLogFor('coiffeur-2')).toEqual([]);
  });
});
