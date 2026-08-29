import { SupabaseService } from '../../database/supabase.service';
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

function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60000).toISOString();
}

describe('AppointmentRemindersJob', () => {
  let supabase: FakeSupabaseService;
  let notifications: NotificationsService;
  let job: AppointmentRemindersJob;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    const pushTokens = new PushTokensService(supabase as unknown as SupabaseService);
    notifications = new NotificationsService(
      supabase as unknown as SupabaseService,
      pushTokens,
      new FakePushService() as unknown as PushService,
    );
    job = new AppointmentRemindersJob(supabase as unknown as SupabaseService, notifications);
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
    expect(notified.map((n) => n.dedupe_key)).toEqual([inWindow]);
    expect(notified[0].type).toBe('appointment_reminder_j1');
  });

  it('sends an H-1 reminder for an appointment ~1h out', async () => {
    const inWindow = seedConfirmed(minutesFromNow(60));

    await job.run();

    const notified = supabase.notifyLogFor(PARTICULIER_ID);
    expect(notified.some((n) => n.dedupe_key === inWindow && n.type === 'appointment_reminder_h1')).toBe(true);
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

  it('running twice never double-sends the same reminder', async () => {
    seedConfirmed(minutesFromNow(24 * 60));

    await job.run();
    await job.run();

    const j1 = supabase.notifyLogFor(PARTICULIER_ID).filter((n) => n.type === 'appointment_reminder_j1');
    expect(j1).toHaveLength(1);
  });
});
