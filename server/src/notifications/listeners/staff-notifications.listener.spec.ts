import { SupabaseService } from '../../database/supabase.service';
import { FakeSupabaseService } from '../../../test/utils/fakes/fake-supabase.service';
import { NotificationsService } from '../notifications.service';
import { PushService } from '../push.service';
import { PushTokensService } from '../push-tokens.service';
import { StaffNotificationsListener } from './staff-notifications.listener';

class FakePushService {
  send: PushService['send'] = async (messages) => messages.map((m) => ({ token: m.token, ok: true }));
}

const SALON = 'owner-1';
const NADIA = 'nadia-1';

describe('StaffNotificationsListener (TODO.md Phase 3)', () => {
  let supabase: FakeSupabaseService;
  let listener: StaffNotificationsListener;
  let owner: string;
  let nadia: string;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    const notifications = new NotificationsService(
      supabase as unknown as SupabaseService,
      new PushTokensService(supabase as unknown as SupabaseService),
      new FakePushService() as unknown as PushService,
    );
    listener = new StaffNotificationsListener(supabase as unknown as SupabaseService, notifications);
    supabase.addUser('nadia-token', { id: NADIA, email: 'nadia@example.com', email_confirmed_at: null }, 'staff', {
      firstName: 'Nadia',
      lastName: 'Kaci',
    });
    owner = supabase.seedStaff({ salonId: SALON, profileId: SALON });
    nadia = supabase.seedStaff({ salonId: SALON, profileId: NADIA });
  });

  const booking = { appointmentId: 'apt-1', serviceName: 'Coupe & brushing', startsAt: '2026-09-30T08:00:00Z' };

  it('tells a staff member of a booking given to them', async () => {
    await listener.onAssigned({ ...booking, salonId: SALON, staffId: nadia });

    const [log] = supabase.notifyLogFor(NADIA);
    expect(log).toMatchObject({ type: 'appointment_assigned', title: 'Nouveau rendez-vous' });
    expect(log.body).toContain('Coupe & brushing');
    expect(log.body).toContain('mer. 30 sept. à 10:00');
  });

  it("leaves the owner be: he hears of his salon's bookings already", async () => {
    await listener.onAssigned({ ...booking, salonId: SALON, staffId: owner });
    expect(supabase.notifyLogFor(SALON)).toEqual([]);
  });

  it('tells them when their booking moves or is cancelled, and only once it was theirs', async () => {
    await listener.onMoved({ ...booking, particulierId: 'client-1', staffId: nadia, previousStartsAt: booking.startsAt, startsAt: '2026-10-01T09:00:00Z' });
    await listener.onCancelled({ ...booking, coiffeurId: SALON, particulierId: 'client-1', staffId: nadia, cancelledByUserId: 'client-1' });
    await listener.onCancelled({ ...booking, appointmentId: 'apt-2', coiffeurId: SALON, particulierId: 'client-1', staffId: null, cancelledByUserId: 'client-1' });

    expect(supabase.notifyLogFor(NADIA).map((log) => log.title)).toEqual(['Rendez-vous déplacé', 'Rendez-vous annulé']);
  });

  it('tells the owner someone joined his salon', async () => {
    await listener.onJoined({ salonId: SALON, profileId: NADIA, staffId: nadia });

    expect(supabase.notifyLogFor(SALON)[0]).toMatchObject({ type: 'staff_joined', title: 'Nouveau membre', body: 'Nadia Kaci a rejoint votre salon.' });
  });
});
