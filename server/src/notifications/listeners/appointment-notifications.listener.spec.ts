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
      startsAt: new Date().toISOString(),
    });

    const log = supabase.notifyLogFor('coiffeur-1');
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ type: 'appointment_created', dedupe_key: 'apt-1' });
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

  it('notifies the coiffeur when the particulier cancels', async () => {
    await listener.onCancelled({
      appointmentId: 'apt-1',
      coiffeurId: 'coiffeur-1',
      cancelledByUserId: 'particulier-1',
      serviceName: 'Coupe & brushing',
      startsAt: new Date().toISOString(),
    });

    expect(supabase.notifyLogFor('coiffeur-1')).toMatchObject([
      { type: 'appointment_cancelled', dedupe_key: 'apt-1' },
    ]);
  });

  it('never notifies the coiffeur of their own cancellation', async () => {
    await listener.onCancelled({
      appointmentId: 'apt-1',
      coiffeurId: 'coiffeur-1',
      cancelledByUserId: 'coiffeur-1',
      serviceName: 'Coupe & brushing',
      startsAt: new Date().toISOString(),
    });

    expect(supabase.notifyLogFor('coiffeur-1')).toEqual([]);
  });
});
