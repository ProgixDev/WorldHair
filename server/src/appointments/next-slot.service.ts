import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { allPages } from '../common/utils/pages';
import { parisParts } from '../common/utils/paris-time';
import { slices } from '../common/utils/slices';
import { SupabaseService } from '../database/supabase.service';
import { SalonService } from '../salon/salon.service';
import { StaffService } from '../staff/staff.service';
import { SubscriptionRow, subscriptionEndsAt } from '../subscriptions/subscription-state';
import { closedAfter, PersonRules, slotsForTeam } from './booking-rules';

export interface NextSlotQuery {
  salonId: string;
  /** The salon's shortest visible prestation: the smallest booking there is. `null`: nothing to book. */
  durationMin: number | null;
  bookingNoticeMinutes: number;
  /** Bookable and payable in the app (TODO.md Phase 5); a salon that isn't has no next slot to show. */
  onlineBooking: boolean;
}

/** How far ahead a salon's next free time is looked for: the booking screen's two weeks. */
export const NEXT_SLOT_DAYS = 14;

const DAY_MS = 86_400_000;

interface BookingRow {
  coiffeur_id: string;
  staff_id: string | null;
  starts_at: string;
  duration_min: number;
}

/** The next `count` Paris calendar days from `now`'s, as YYYY-MM-DD. */
function upcomingDays(now: Date, count: number): string[] {
  const today = parisParts(now);
  return Array.from({ length: count }, (_, offset) =>
    new Date(Date.UTC(today.year, today.month - 1, today.day + offset)).toISOString().slice(0, 10),
  );
}

/**
 * When each salon can next take a booking — "Dispo aujourd'hui 14:30" on
 * search cards, and search's sort by availability (TODO.md Phase 6). The
 * booking grid's own rules (booking-rules.ts) for the salon's shortest
 * visible prestation, within two weeks, read in a few batched queries
 * whatever the number of salons.
 */
@Injectable()
export class NextSlotService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly salon: SalonService,
    private readonly staff: StaffService,
  ) {}

  /** Each salon's next free start (ISO), or `null`: not bookable online, nothing to book, or full for two weeks. */
  async nextSlots(queries: NextSlotQuery[], now = new Date()): Promise<Map<string, string | null>> {
    const result = new Map<string, string | null>(queries.map((query) => [query.salonId, null]));
    const bookable = queries.filter((query) => query.onlineBooking && query.durationMin);
    if (bookable.length === 0) return result;

    const ids = bookable.map((query) => query.salonId);
    // Nothing starting past the days looked at can take a slot in them.
    const until = new Date(now.getTime() + (NEXT_SLOT_DAYS + 1) * DAY_MS);
    const [availability, closures, bookings, subscriptions, teams] = await Promise.all([
      this.salon.availabilityFor(ids),
      this.salon.timeOffFor(ids, now, until),
      this.activeBookingsOf(ids, now, until),
      this.subscriptionsOf(ids),
      this.staff.teamsFor(ids),
    ]);
    const days = upcomingDays(now, NEXT_SLOT_DAYS);

    for (const query of bookable) {
      const salonClosures = closures.get(query.salonId) ?? [];
      const ends = closedAfter(subscriptionEndsAt(subscriptions.get(query.salonId) ?? null, now));
      const team = teams.get(query.salonId) ?? [];
      const ownerId = team.find((member) => member.isOwner)?.id;
      // Free when someone who takes clients' bookings is (TODO.md Phase 3).
      const people: PersonRules[] = team
        .filter((member) => member.takesBookings)
        .map((member) => ({
          staffId: member.id,
          position: member.position,
          rules: {
            availability: availability.get(query.salonId) ?? [],
            personalAvailability: member.availability,
            closures: [
              ...salonClosures
                .filter((closure) => closure.staffId === null || closure.staffId === member.id)
                .map(({ startsAt, endsAt }) => ({ startsAt, endsAt })),
              ...ends,
            ],
            salonBookings: (bookings.get(query.salonId) ?? [])
              .filter((booking) => (booking.staff_id ?? ownerId) === member.id)
              .map((booking) => ({ startsAt: booking.starts_at, durationMin: booking.duration_min })),
            clientBookings: [],
            bookingNoticeMinutes: query.bookingNoticeMinutes,
            now,
          },
        }));
      for (const day of days) {
        const free = slotsForTeam(people, day, query.durationMin!).slots.find((slot) => slot.available);
        if (free) {
          result.set(query.salonId, free.startsAt);
          break;
        }
      }
    }
    return result;
  }

  /**
   * Bookings, and slots held while a client pays, from a day before `now`
   * (a booking fits in a day) to `until` — every one of them, page by page:
   * a busy week at a hundred salons is past PostgREST's 1 000 rows.
   */
  private async activeBookingsOf(ids: string[], now: Date, until: Date): Promise<Map<string, BookingRow[]>> {
    const byCoiffeur = new Map<string, BookingRow[]>(ids.map((id) => [id, []]));
    for (const slice of slices(ids)) {
      const rows = await allPages<BookingRow>((from, to) =>
        this.supabase.client
          .from('appointments')
          .select('coiffeur_id, staff_id, starts_at, duration_min')
          .in('coiffeur_id', slice)
          .in('status', ['awaiting_payment', 'pending', 'confirmed'])
          .gte('starts_at', new Date(now.getTime() - DAY_MS).toISOString())
          .lt('starts_at', until.toISOString())
          .order('starts_at')
          .order('id')
          .range(from, to),
      );
      for (const row of rows) {
        byCoiffeur.get(row.coiffeur_id)?.push(row);
      }
    }
    return byCoiffeur;
  }

  private async subscriptionsOf(ids: string[]): Promise<Map<string, SubscriptionRow>> {
    const byProfile = new Map<string, SubscriptionRow>();
    for (const slice of slices(ids)) {
      const { data, error } = await this.supabase.client.from('coiffeur_subscriptions').select().in('profile_id', slice);
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
      for (const row of data as SubscriptionRow[]) byProfile.set(row.profile_id, row);
    }
    return byProfile;
  }
}
