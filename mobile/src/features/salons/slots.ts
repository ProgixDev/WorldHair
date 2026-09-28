import { startOfDay } from "../../utils/date";
import type { Salon } from "./types";

/**
 * The booking grid itself comes from the server (GET
 * /appointments/salon/:id/slots — see fetchSlots in ./api.ts), built from the
 * same rules that accept or refuse a booking: hours, lunch break, closures,
 * existing bookings, the salon's booking notice. What's left here is only
 * the day strip above it.
 */

/** One start in the server's grid for a day. */
export interface Slot {
  /** ISO instant. */
  startsAt: string;
  /** "09:30", on the salon's clock. */
  label: string;
  available: boolean;
}

export interface DaySlots {
  /** YYYY-MM-DD. */
  date: string;
  /** Closed all day: weekly closed day, or a closure covering the whole opening. */
  closed: boolean;
  slots: Slot[];
}

/** "2026-09-30" — the local calendar day, the format the slots endpoint takes. */
export function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export interface BookingDay {
  date: Date;
  /** A closure covers the whole opening that day — shown greyed, nothing to book. */
  closed: boolean;
}

/**
 * The next `count` days the salon opens in its usual week, starting today.
 * Days inside a closure stay in the strip (greyed), so the client sees the
 * salon is away rather than wondering where the days went.
 */
export function bookingDays(salon: Salon, count: number, from = new Date()): BookingDay[] {
  const days: BookingDay[] = [];
  const cursor = startOfDay(from);
  for (let offset = 0; days.length < count && offset < count * 3; offset++) {
    const date = new Date(cursor);
    date.setDate(cursor.getDate() + offset);
    const hours = salon.hours.find((h) => h.weekday === date.getDay());
    if (!hours || hours.opens === null || hours.closes === null) continue;

    const opensAt = new Date(date);
    opensAt.setMinutes(hours.opens);
    const closesAt = new Date(date);
    closesAt.setMinutes(hours.closes);
    const closed = (salon.closures ?? []).some(
      (closure) =>
        new Date(closure.startsAt).getTime() <= opensAt.getTime() &&
        new Date(closure.endsAt).getTime() >= closesAt.getTime(),
    );
    days.push({ date, closed });
  }
  return days;
}
