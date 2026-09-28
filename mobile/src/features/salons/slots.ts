import { isSameDay, minutesToTime, startOfDay } from "../../utils/date";
import type { Salon } from "./types";

export interface Slot {
  /** Minutes from midnight. */
  minutes: number;
  label: string;
  available: boolean;
}

/** A booking that already holds time: this salon's (anyone's) or the user's own elsewhere. */
export interface BusyInterval {
  startsAt: string;
  durationMin: number;
}

const STEP_MIN = 30;
const MINUTE_MS = 60_000;

function overlaps(startMs: number, endMs: number, busy: BusyInterval): boolean {
  const busyStart = new Date(busy.startsAt).getTime();
  const busyEnd = busyStart + busy.durationMin * MINUTE_MS;
  return startMs < busyEnd && busyStart < endMs;
}

/**
 * Bookable starts for one salon on one day: inside opening hours, long enough
 * for the service to finish before closing, never in the past, clear of the
 * lunch break, and not overlapping any existing booking over its whole
 * length — the same rules the server enforces, so a free slot here is one
 * the server accepts.
 */
export function slotsForDay(params: {
  salon: Salon;
  day: Date;
  durationMin: number;
  busy?: BusyInterval[];
  now?: Date;
}): Slot[] {
  const { salon, day, durationMin, busy = [], now = new Date() } = params;
  const hours = salon.hours.find((h) => h.weekday === day.getDay());
  if (!hours || hours.opens === null || hours.closes === null) return [];

  const nowMinutes = isSameDay(day, now)
    ? now.getHours() * 60 + now.getMinutes()
    : -1;
  const breakStart = hours.breakStart ?? null;
  const breakEnd = hours.breakEnd ?? null;

  const slots: Slot[] = [];
  for (
    let minutes = hours.opens;
    minutes + durationMin <= hours.closes;
    minutes += STEP_MIN
  ) {
    const endMinutes = minutes + durationMin;
    const startMs = slotToDate(day, minutes).getTime();
    const endMs = startMs + durationMin * MINUTE_MS;

    const isPast = minutes <= nowMinutes;
    const inBreak =
      breakStart !== null &&
      breakEnd !== null &&
      minutes < breakEnd &&
      endMinutes > breakStart;
    const isBusy = busy.some((interval) => overlaps(startMs, endMs, interval));

    slots.push({
      minutes,
      label: minutesToTime(minutes),
      available: !isPast && !inBreak && !isBusy,
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
