import { parisParts, parisTime } from '../common/utils/paris-time';
import { AvailabilityDay } from '../salon/salon.service';

/**
 * The one place that decides whether a booking can start at a given time —
 * used by the slot grid the app shows AND by every write (booking, a
 * client's move, a coiffeur's move), so a slot shown as free is exactly a
 * slot the server accepts. Pure: callers load the data, this only decides.
 * Hours are Paris wall-clock times (see paris-time.ts).
 */

export interface TimeRange {
  startsAt: string;
  endsAt: string;
}

export interface BusyBooking {
  startsAt: string;
  durationMin: number;
}

export interface BookingRules {
  availability: AvailabilityDay[];
  /** Congés and exceptional closures. */
  closures: TimeRange[];
  /** The salon's other active (pending/confirmed) bookings. */
  salonBookings: BusyBooking[];
  /** The client's own active bookings anywhere; empty when the coiffeur is the one moving an appointment. */
  clientBookings: BusyBooking[];
  /** How late before its start a booking is still accepted; 0 = up to the start itself. */
  bookingNoticeMinutes: number;
  now: Date;
}

export type SlotRefusal =
  | 'past'
  | 'too_soon'
  | 'closed'
  | 'outside_hours'
  | 'break'
  | 'time_off'
  | 'taken'
  | 'client_busy';

export interface DaySlots {
  /** YYYY-MM-DD, Paris calendar. */
  date: string;
  closed: boolean;
  slots: { startsAt: string; label: string; available: boolean }[];
}

const STEP_MIN = 30;
const MINUTE_MS = 60_000;

function overlaps(startMs: number, endMs: number, otherStartMs: number, otherEndMs: number): boolean {
  return startMs < otherEndMs && otherStartMs < endMs;
}

function overlapsBooking(startMs: number, endMs: number, booking: BusyBooking): boolean {
  const bookingStart = new Date(booking.startsAt).getTime();
  return overlaps(startMs, endMs, bookingStart, bookingStart + booking.durationMin * MINUTE_MS);
}

function overlapsRange(startMs: number, endMs: number, range: TimeRange): boolean {
  return overlaps(startMs, endMs, new Date(range.startsAt).getTime(), new Date(range.endsAt).getTime());
}

/** Why a booking can't start at `startsAt` for `durationMin` minutes, or `null` when it can. */
export function refusalFor(rules: BookingRules, startsAt: Date, durationMin: number): SlotRefusal | null {
  const startMs = startsAt.getTime();
  const endMs = startMs + durationMin * MINUTE_MS;
  const nowMs = rules.now.getTime();

  if (startMs < nowMs) return 'past';
  if (startMs < nowMs + rules.bookingNoticeMinutes * MINUTE_MS) return 'too_soon';

  const paris = parisParts(startsAt);
  const day = rules.availability.find((d) => d.weekday === paris.weekday);
  if (!day?.isOpen) return 'closed';

  const startMinute = paris.hour * 60 + paris.minute;
  const endMinute = startMinute + durationMin;
  if (startMinute < day.opensMinute || endMinute > day.closesMinute) return 'outside_hours';
  if (
    day.breakStartMinute !== null &&
    day.breakEndMinute !== null &&
    startMinute < day.breakEndMinute &&
    endMinute > day.breakStartMinute
  ) {
    return 'break';
  }

  if (rules.closures.some((range) => overlapsRange(startMs, endMs, range))) return 'time_off';
  if (rules.salonBookings.some((booking) => overlapsBooking(startMs, endMs, booking))) return 'taken';
  if (rules.clientBookings.some((booking) => overlapsBooking(startMs, endMs, booking))) return 'client_busy';
  return null;
}

function label(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Every half-hour start on `date` (YYYY-MM-DD, Paris) where a `durationMin` booking fits, each marked free or not. */
export function slotsForDay(rules: BookingRules, date: string, durationMin: number): DaySlots {
  const [year, month, dayOfMonth] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, dayOfMonth)).getUTCDay();
  const hours = rules.availability.find((d) => d.weekday === weekday);
  if (!hours?.isOpen) return { date, closed: true, slots: [] };

  const opensMs = parisTime(year, month, dayOfMonth, 0, hours.opensMinute).getTime();
  const closesMs = parisTime(year, month, dayOfMonth, 0, hours.closesMinute).getTime();
  const closedAllDay = rules.closures.some(
    (range) => new Date(range.startsAt).getTime() <= opensMs && new Date(range.endsAt).getTime() >= closesMs,
  );
  if (closedAllDay) return { date, closed: true, slots: [] };

  const slots: DaySlots['slots'] = [];
  for (let minutes = hours.opensMinute; minutes + durationMin <= hours.closesMinute; minutes += STEP_MIN) {
    const startsAt = parisTime(year, month, dayOfMonth, 0, minutes);
    slots.push({
      startsAt: startsAt.toISOString(),
      label: label(minutes),
      available: refusalFor(rules, startsAt, durationMin) === null,
    });
  }
  return { date, closed: false, slots };
}
