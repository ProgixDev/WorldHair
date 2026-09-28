import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';
import { SupabaseService } from '../../database/supabase.service';
import { MailService } from '../../mail/mail.service';
import { FakeSupabaseService } from '../../../test/utils/fakes/fake-supabase.service';
import { NotificationsService } from '../notifications.service';
import { PushService } from '../push.service';
import { PushTokensService } from '../push-tokens.service';
import { AppointmentRemindersJob } from './appointment-reminders.job';

const PARTICULIER_ID = 'particulier-1';
const COIFFEUR_ID = 'coiffeur-1';

/** Never calls real Expo infra. */
class FakePushService {
  send: PushService['send'] = async (messages) => messages.map((m) => ({ token: m.token, ok: true }));
}

/** MAIL_TRANSPORT=json — MailService renders instead of actually sending. */
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

function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60000).toISOString();
}

describe('AppointmentRemindersJob', () => {
  let supabase: FakeSupabaseService;
  let notifications: NotificationsService;
  let pushTokens: PushTokensService;
  let mail: MailService;
  let job: AppointmentRemindersJob;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    supabase.addUser('particulier-token', { id: PARTICULIER_ID, email: 'camille@example.com', email_confirmed_at: null });
    pushTokens = new PushTokensService(supabase as unknown as SupabaseService);
    notifications = new NotificationsService(
      supabase as unknown as SupabaseService,
      pushTokens,
      new FakePushService() as unknown as PushService,
    );
    mail = new MailService(fakeMailConfig());
    job = new AppointmentRemindersJob(supabase as unknown as SupabaseService, notifications, pushTokens, mail);
  });

  describe('email fallback for the J-1 reminder', () => {
    it('emails a client who has no phone registered for push', async () => {
      const emailSpy = jest.spyOn(mail, 'sendAppointmentReminderEmail');
      const startsAt = minutesFromNow(24 * 60);
      seedConfirmed(startsAt);

      await job.run();

      expect(emailSpy).toHaveBeenCalledWith('camille@example.com', 'Coupe & brushing', startsAt);
    });

    it('does not email a client who gets the push', async () => {
      const emailSpy = jest.spyOn(mail, 'sendAppointmentReminderEmail');
      await pushTokens.register(PARTICULIER_ID, 'ExponentPushToken[abc]', 'ios');
      seedConfirmed(minutesFromNow(24 * 60));

      await job.run();

      expect(emailSpy).not.toHaveBeenCalled();
    });

    it('emails once per appointment however often the job runs, and never for the H-1 reminder', async () => {
      const emailSpy = jest.spyOn(mail, 'sendAppointmentReminderEmail');
      seedConfirmed(minutesFromNow(24 * 60));
      seedConfirmed(minutesFromNow(60));

      await job.run();
      await job.run();

      expect(emailSpy).toHaveBeenCalledTimes(1);
    });
  });

  function seedConfirmed(startsAt: string): string {
    return supabase.seedAppointment({
      particulierId: PARTICULIER_ID,
      coiffeurId: COIFFEUR_ID,
      serviceName: 'Coupe & brushing',
      startsAt,
      status: 'confirmed',
    });
  }

  it('sends a J-1 reminder for an appointment ~24h out, not for one ~12h or ~48h out', async () => {
    const inWindow = seedConfirmed(minutesFromNow(24 * 60));
    seedConfirmed(minutesFromNow(12 * 60));
    seedConfirmed(minutesFromNow(48 * 60));

    await job.run();

    const notified = supabase.notifyLogFor(PARTICULIER_ID);
    expect(notified.map((n) => n.dedupe_key.startsWith(inWindow))).toEqual([true]);
    expect(notified[0].type).toBe('appointment_reminder_j1');
  });

  it('sends an H-1 reminder for an appointment ~1h out', async () => {
    const inWindow = seedConfirmed(minutesFromNow(60));

    await job.run();

    const notified = supabase.notifyLogFor(PARTICULIER_ID);
    expect(notified.some((n) => n.dedupe_key.startsWith(inWindow) && n.type === 'appointment_reminder_h1')).toBe(true);
  });

  it('never reminds a pending or cancelled appointment, only confirmed ones', async () => {
    supabase.seedAppointment({
      particulierId: PARTICULIER_ID,
      coiffeurId: COIFFEUR_ID,
      startsAt: minutesFromNow(24 * 60),
      status: 'pending',
    });

    await job.run();

    expect(supabase.notifyLogFor(PARTICULIER_ID)).toEqual([]);
  });

  it("skips a reminder the particulier has disabled", async () => {
    await notifications.updatePreferences(PARTICULIER_ID, { reminderDayBefore: false });
    seedConfirmed(minutesFromNow(24 * 60));

    await job.run();

    expect(supabase.notifyLogFor(PARTICULIER_ID).some((n) => n.type === 'appointment_reminder_j1')).toBe(false);
  });

  it('reminds again for the new time once the appointment has moved', async () => {
    const id = seedConfirmed(minutesFromNow(24 * 60));
    await job.run();

    supabase.seedAppointment({
      id, // same booking, new time — what a move or a reschedule leaves behind
      particulierId: PARTICULIER_ID,
      coiffeurId: COIFFEUR_ID,
      serviceName: 'Coupe & brushing',
      startsAt: minutesFromNow(24 * 60 + 30),
      status: 'confirmed',
    });
    await job.run();

    const j1 = supabase.notifyLogFor(PARTICULIER_ID).filter((n) => n.type === 'appointment_reminder_j1');
    expect(j1).toHaveLength(2);
  });

  it('running twice never double-sends the same reminder', async () => {
    seedConfirmed(minutesFromNow(24 * 60));

    await job.run();
    await job.run();

    const j1 = supabase.notifyLogFor(PARTICULIER_ID).filter((n) => n.type === 'appointment_reminder_j1');
    expect(j1).toHaveLength(1);
  });
});
