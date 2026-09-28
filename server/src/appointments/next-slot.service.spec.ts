import { SupabaseService } from '../database/supabase.service';
import { parisTime } from '../common/utils/paris-time';
import { SalonService } from '../salon/salon.service';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { NextSlotService } from './next-slot.service';

// A Wednesday, 10:15 in Paris: inside the default hours (Mon-Sat 9-19, lunch 13-14).
const WEDNESDAY_1015 = parisTime(2026, 9, 30, 10, 15);

describe('NextSlotService', () => {
  let supabase: FakeSupabaseService;
  let nextSlots: NextSlotService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    nextSlots = new NextSlotService(supabase as unknown as SupabaseService, new SalonService(supabase as unknown as SupabaseService));
  });

  const query = (salonId: string) => ({ salonId, durationMin: 30, bookingNoticeMinutes: 0, onlineBooking: true });

  it("reads every booking, past the 1 000 rows PostgREST answers at most", async () => {
    // 50 salons with 20 bookings each next week, read before the busy one's.
    const others = Array.from({ length: 50 }, (_, index) => `salon-${String(index).padStart(2, '0')}`);
    for (const salonId of others) {
      for (let slot = 0; slot < 20; slot += 1) {
        supabase.seedAppointment({
          particulierId: 'someone',
          coiffeurId: salonId,
          startsAt: parisTime(2026, 10, 7, 9, slot * 30).toISOString(),
          durationMin: 30,
          status: 'confirmed',
        });
      }
    }
    // The rest of Wednesday is taken at the busy salon: 10:30-13:00 and 14:00-19:00.
    for (const [hour, minute, durationMin] of [
      [10, 30, 150],
      [14, 0, 300],
    ]) {
      supabase.seedAppointment({
        particulierId: 'someone',
        coiffeurId: 'busy',
        startsAt: parisTime(2026, 9, 30, hour, minute).toISOString(),
        durationMin,
        status: 'confirmed',
      });
    }

    const slots = await nextSlots.nextSlots([...others, 'busy'].map(query), WEDNESDAY_1015);

    expect(slots.get('busy')).toBe(parisTime(2026, 10, 1, 9, 0).toISOString());
  });
});
