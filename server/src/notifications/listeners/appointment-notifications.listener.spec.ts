import { SupabaseService } from '../../database/supabase.service';
import { FakeSupabaseService } from '../../../test/utils/fakes/fake-supabase.service';
import { NotificationsService } from '../notifications.service';
import { PushService } from '../push.service';
import { PushTokensService } from '../push-tokens.service';
import { AppointmentNotificationsListener } from './appointment-notifications.listener';

class FakePushService {
  send: PushService['send'] = async (messages) => messages.map((m) => ({ token: m.token, ok: true }));
}

describe('AppointmentNotificationsListener', () => {
  let supabase: FakeSupabaseService;
  let listener: AppointmentNotificationsListener;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    const pushTokens = new PushTokensService(supabase as unknown as SupabaseService);
    const notifications = new NotificationsService(
      supabase as unknown as SupabaseService,
      pushTokens,
      new FakePushService() as unknown as PushService,
    );
    listener = new AppointmentNotificationsListener(notifications);
  });

  it('notifies the coiffeur of a new request', async () => {
    await listener.onCreated({
      appointmentId: 'apt-1',
      coiffeurId: 'coiffeur-1',
      serviceName: 'Coupe & brushing',
      startsAt: '2026-09-30T08:00:00Z',
      status: 'pending',
    });

    const log = supabase.notifyLogFor('coiffeur-1');
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ type: 'appointment_created', dedupe_key: 'apt-1', title: 'Nouvelle demande de rendez-vous' });
    expect(log[0].body).toContain('mer. 30 sept. à 10:00');
  });

  it('announces an instantly confirmed booking as a booking, not a request', async () => {
    await listener.onCreated({
      appointmentId: 'apt-1',
      coiffeurId: 'coiffeur-1',
      serviceName: 'Coupe & brushing',
      startsAt: '2026-09-30T08:00:00Z',
      status: 'confirmed',
    });

    expect(supabase.notifyLogFor('coiffeur-1')[0]).toMatchObject({ title: 'Nouveau rendez-vous' });
  });

  it('tells the particulier each time the salon moves their appointment', async () => {
    await listener.onMoved({
      appointmentId: 'apt-1',
      particulierId: 'particulier-1',
      serviceName: 'Coupe & brushing',
      previousStartsAt: '2026-09-30T08:00:00Z',
      startsAt: '2026-10-01T09:00:00Z',
    });

    const log = supabase.notifyLogFor('particulier-1');
    expect(log).toMatchObject([{ type: 'appointment_moved', dedupe_key: 'apt-1:2026-10-01T09:00:00Z' }]);
    expect(log[0].body).toContain('jeu. 1 oct. à 11:00');
  });

  it('notifies the particulier once their request is confirmed', async () => {
    await listener.onConfirmed({
      appointmentId: 'apt-1',
      particulierId: 'particulier-1',
      serviceName: 'Coupe & brushing',
      startsAt: new Date().toISOString(),
    });

    expect(supabase.notifyLogFor('particulier-1')).toMatchObject([
      { type: 'appointment_confirmed', dedupe_key: 'apt-1' },
    ]);
  });

  it('tells the particulier their request was refused, with its date', async () => {
    await listener.onRefused({
      appointmentId: 'apt-1',
      particulierId: 'particulier-1',
      serviceName: 'Coupe & brushing',
      startsAt: '2026-09-30T08:00:00Z',
    });

    const log = supabase.notifyLogFor('particulier-1');
    expect(log).toMatchObject([{ type: 'appointment_refused', dedupe_key: 'apt-1' }]);
    expect(log[0].body).toContain('mer. 30 sept. à 10:00');
  });

  it('notifies the coiffeur, and only the coiffeur, when the particulier cancels', async () => {
    await listener.onCancelled({
      appointmentId: 'apt-1',
      coiffeurId: 'coiffeur-1',
      particulierId: 'particulier-1',
      cancelledByUserId: 'particulier-1',
      serviceName: 'Coupe & brushing',
      startsAt: new Date().toISOString(),
    });

    expect(supabase.notifyLogFor('coiffeur-1')).toMatchObject([
      { type: 'appointment_cancelled', dedupe_key: 'apt-1' },
    ]);
    expect(supabase.notifyLogFor('particulier-1')).toEqual([]);
  });

  it('notifies the particulier, and only the particulier, when the salon cancels', async () => {
    await listener.onCancelled({
      appointmentId: 'apt-1',
      coiffeurId: 'coiffeur-1',
      particulierId: 'particulier-1',
      cancelledByUserId: 'coiffeur-1',
      serviceName: 'Coupe & brushing',
      startsAt: '2026-09-30T08:00:00Z',
    });

    const log = supabase.notifyLogFor('particulier-1');
    expect(log).toMatchObject([{ type: 'appointment_cancelled', dedupe_key: 'apt-1' }]);
    expect(log[0].body).toContain('mer. 30 sept. à 10:00');
    expect(supabase.notifyLogFor('coiffeur-1')).toEqual([]);
  });

  it('tells the coiffeur each time the particulier moves the appointment', async () => {
    const move = (startsAt: string) =>
      listener.onRescheduled({
        appointmentId: 'apt-1',
        coiffeurId: 'coiffeur-1',
        serviceName: 'Coupe & brushing',
        previousStartsAt: '2026-09-30T08:00:00Z',
        startsAt,
      });

    await move('2026-10-01T09:00:00Z');
    await move('2026-10-02T09:00:00Z');

    const log = supabase.notifyLogFor('coiffeur-1');
    expect(log).toHaveLength(2);
    expect(log[0]).toMatchObject({ type: 'appointment_rescheduled' });
    expect(log[0].body).toContain('jeu. 1 oct. à 11:00');
  });
});
