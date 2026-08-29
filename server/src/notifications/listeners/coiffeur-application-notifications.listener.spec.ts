import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';
import { SupabaseService } from '../../database/supabase.service';
import { MailService } from '../../mail/mail.service';
import { FakeSupabaseService } from '../../../test/utils/fakes/fake-supabase.service';
import { NotificationsService } from '../notifications.service';
import { PushService } from '../push.service';
import { PushTokensService } from '../push-tokens.service';
import { CoiffeurApplicationNotificationsListener } from './coiffeur-application-notifications.listener';

class FakePushService {
  send: PushService['send'] = async (messages) => messages.map((m) => ({ token: m.token, ok: true }));
}

/** MAIL_TRANSPORT=json — MailService renders instead of actually sending, no SMTP needed. */
function fakeMailConfig(): ConfigService<EnvironmentVariables, true> {
  const values: Record<string, unknown> = {
    MAIL_TRANSPORT: 'json',
    MAIL_HOST: '',
    MAIL_PORT: 587,
    MAIL_SECURE: false,
    MAIL_USER: '',
    MAIL_PASSWORD: '',
    MAIL_FROM: 'WorldHair <no-reply@worldhair.app>',
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService<EnvironmentVariables, true>;
}

const PROFILE_ID = 'coiffeur-1';

describe('CoiffeurApplicationNotificationsListener', () => {
  let supabase: FakeSupabaseService;
  let mail: MailService;
  let listener: CoiffeurApplicationNotificationsListener;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    supabase.addUser('token', { id: PROFILE_ID, email: 'sofia@example.com', email_confirmed_at: null }, 'coiffeur');

    const pushTokens = new PushTokensService(supabase as unknown as SupabaseService);
    const notifications = new NotificationsService(
      supabase as unknown as SupabaseService,
      pushTokens,
      new FakePushService() as unknown as PushService,
    );
    mail = new MailService(fakeMailConfig());
    listener = new CoiffeurApplicationNotificationsListener(notifications, mail, supabase as unknown as SupabaseService);
  });

  it('pushes and emails on validation', async () => {
    const emailSpy = jest.spyOn(mail, 'sendCoiffeurApplicationDecidedEmail');

    await listener.onDecided({ applicationId: 'app-1', profileId: PROFILE_ID, status: 'validated' });

    expect(supabase.notifyLogFor(PROFILE_ID)).toMatchObject([
      { type: 'coiffeur_application_decided', dedupe_key: 'app-1:validated' },
    ]);
    expect(emailSpy).toHaveBeenCalledWith('sofia@example.com', 'validated', undefined);
  });

  it('pushes and emails on rejection, including the review message', async () => {
    const emailSpy = jest.spyOn(mail, 'sendCoiffeurApplicationDecidedEmail');

    await listener.onDecided({
      applicationId: 'app-1',
      profileId: PROFILE_ID,
      status: 'rejected',
      reviewMessage: 'Diplôme illisible',
    });

    expect(supabase.notifyLogFor(PROFILE_ID)).toMatchObject([
      { type: 'coiffeur_application_decided', dedupe_key: 'app-1:rejected' },
    ]);
    expect(emailSpy).toHaveBeenCalledWith('sofia@example.com', 'rejected', 'Diplôme illisible');
  });

  it('a later re-decision after resubmission notifies again (different dedupe key)', async () => {
    await listener.onDecided({ applicationId: 'app-1', profileId: PROFILE_ID, status: 'rejected', reviewMessage: 'x' });
    await listener.onDecided({ applicationId: 'app-1', profileId: PROFILE_ID, status: 'validated' });

    expect(supabase.notifyLogFor(PROFILE_ID)).toHaveLength(2);
  });

  it('does not throw when the profile has no resolvable email', async () => {
    await expect(
      listener.onDecided({ applicationId: 'app-1', profileId: 'unknown-profile', status: 'validated' }),
    ).resolves.toBeUndefined();
  });
});
