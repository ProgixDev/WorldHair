import { isSameDay, minutesToTime, startOfDay } from "../../utils/date";
import type { Salon } from "./types";

export interface Slot {
  /** Minutes from midnight. */
  minutes: number;
  label: string;
  available: boolean;
}

const STEP_MIN = 30;

/**
 * Deterministic "already booked" mask. A real agenda comes from the backend;
 * until then the same salon/day always shows the same holes, so navigating
 * back and forth never reshuffles the grid under the user.
 */
function pseudoBusy(salonId: string, day: Date, minutes: number): boolean {
  let hash = day.getDate() * 31 + day.getMonth() * 17 + minutes;
  for (let i = 0; i < salonId.length; i++)
    hash = (hash * 33 + salonId.charCodeAt(i)) % 9973;
  return hash % 10 < 4;
}

/**
 * Bookable starts for one salon on one day: inside opening hours, long enough
 * for the service to finish before closing, never in the past, and minus the
 * slots the user already holds.
 */
export function slotsForDay(params: {
  salon: Salon;
  day: Date;
  durationMin: number;
  /** ISO starts already taken by this user, any salon. */
  taken?: string[];
  now?: Date;
}): Slot[] {
  const { salon, day, durationMin, taken = [], now = new Date() } = params;
  const hours = salon.hours.find((h) => h.weekday === day.getDay());
  if (!hours || hours.opens === null || hours.closes === null) return [];

  const takenMinutes = new Set(
    taken
      .map((iso) => new Date(iso))
      .filter((date) => isSameDay(date, day))
      .map((date) => date.getHours() * 60 + date.getMinutes()),
  );

  const nowMinutes = isSameDay(day, now)
    ? now.getHours() * 60 + now.getMinutes()
    : -1;

  const slots: Slot[] = [];
  for (
    let minutes = hours.opens;
    minutes + durationMin <= hours.closes;
    minutes += STEP_MIN
  ) {
    const isPast = minutes <= nowMinutes;
    const isTaken = takenMinutes.has(minutes);
    slots.push({
      minutes,
      label: minutesToTime(minutes),
      available: !isPast && !isTaken && !pseudoBusy(salon.id, day, minutes),
    });
  }

  return slots;
}

/** Turns a day + minutes-from-midnight into the appointment's start Date. */
export function slotToDate(day: Date, minutes: number): Date {
  const date = startOfDay(day);
  date.setMinutes(minutes);
  return date;
}

/** Next N days the salon is open, starting today. */
export function openDays(
  salon: Salon,
  count: number,
  from = new Date(),
): Date[] {
  const days: Date[] = [];
  const cursor = startOfDay(from);
  for (let offset = 0; days.length < count && offset < count * 3; offset++) {
    const day = new Date(cursor);
    day.setDate(cursor.getDate() + offset);
    const hours = salon.hours.find((h) => h.weekday === day.getDay());
    if (hours?.opens !== null && hours?.closes !== null) days.push(day);
  }
  return days;
}
