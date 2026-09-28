import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { parisParts } from '../common/utils/paris-time';
import { slices } from '../common/utils/slices';
import { SupabaseService } from '../database/supabase.service';
import { SalonService } from '../salon/salon.service';
import { SubscriptionRow, subscriptionEndsAt } from '../subscriptions/subscription-state';
import { BookingRules, BusyBooking, closedAfter, slotsForDay } from './booking-rules';

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
  ) {}

  /** Each salon's next free start (ISO), or `null`: not bookable online, nothing to book, or full for two weeks. */
  async nextSlots(queries: NextSlotQuery[], now = new Date()): Promise<Map<string, string | null>> {
    const result = new Map<string, string | null>(queries.map((query) => [query.salonId, null]));
    const bookable = queries.filter((query) => query.onlineBooking && query.durationMin);
    if (bookable.length === 0) return result;

    const ids = bookable.map((query) => query.salonId);
    const [availability, closures, bookings, subscriptions] = await Promise.all([
      this.salon.availabilityFor(ids),
      this.salon.timeOffFor(ids, now),
      this.activeBookingsOf(ids, now),
      this.subscriptionsOf(ids),
    ]);
    const days = upcomingDays(now, NEXT_SLOT_DAYS);

    for (const query of bookable) {
      const rules: BookingRules = {
        availability: availability.get(query.salonId) ?? [],
        closures: [
          ...(closures.get(query.salonId) ?? []).map(({ startsAt, endsAt }) => ({ startsAt, endsAt })),
          ...closedAfter(subscriptionEndsAt(subscriptions.get(query.salonId) ?? null, now)),
        ],
        salonBookings: bookings.get(query.salonId) ?? [],
        clientBookings: [],
        bookingNoticeMinutes: query.bookingNoticeMinutes,
        now,
      };
      for (const day of days) {
        const free = slotsForDay(rules, day, query.durationMin!).slots.find((slot) => slot.available);
        if (free) {
          result.set(query.salonId, free.startsAt);
          break;
        }
      }
    }
    return result;
  }

  /** Bookings, and slots held while a client pays, not over yet — a booking fits in a day, so none older than one. */
  private async activeBookingsOf(ids: string[], now: Date): Promise<Map<string, BusyBooking[]>> {
    const byCoiffeur = new Map<string, BusyBooking[]>(ids.map((id) => [id, []]));
    for (const slice of slices(ids)) {
      const { data, error } = await this.supabase.client
        .from('appointments')
        .select('coiffeur_id, starts_at, duration_min')
        .in('coiffeur_id', slice)
        .in('status', ['awaiting_payment', 'pending', 'confirmed'])
        .gte('starts_at', new Date(now.getTime() - DAY_MS).toISOString());
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
      for (const row of data as unknown as BookingRow[]) {
        byCoiffeur.get(row.coiffeur_id)?.push({ startsAt: row.starts_at, durationMin: row.duration_min });
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
