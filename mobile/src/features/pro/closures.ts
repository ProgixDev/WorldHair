import { addDays, dayAndMonth, minutesToTime, startOfDay, weekdayShort } from "../../utils/date";
import type { TimeOff } from "./types";

/**
 * Congés and exceptional closures are plain time ranges on the server. The
 * coiffeur picks either whole days or a few hours of one day; these turn
 * that choice into a range, and a range back into words and agenda blocks.
 * Local time is the salon's own clock (the phone is in France).
 */

/** From midnight on the first day to midnight after the last one. */
export function wholeDaysRange(from: Date, to: Date): { startsAt: string; endsAt: string } {
  return {
    startsAt: startOfDay(from).toISOString(),
    endsAt: addDays(startOfDay(to), 1).toISOString(),
  };
}

/** `fromMinute`–`toMinute` (minutes from midnight) on `day`. */
export function hoursRange(
  day: Date,
  fromMinute: number,
  toMinute: number,
): { startsAt: string; endsAt: string } {
  const start = startOfDay(day);
  const end = startOfDay(day);
  start.setMinutes(fromMinute);
  end.setMinutes(toMinute);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

function isMidnight(date: Date): boolean {
  return date.getHours() === 0 && date.getMinutes() === 0;
}

function shortDay(date: Date): string {
  return weekdayShort(date) + " " + dayAndMonth(date);
}

/** "mar. 6 oct., toute la journée", "du mar. 6 oct. au jeu. 8 oct.", "mar. 6 oct., 14:00–19:00". */
export function describeClosure(closure: Pick<TimeOff, "startsAt" | "endsAt">): string {
  const start = new Date(closure.startsAt);
  const end = new Date(closure.endsAt);
  if (isMidnight(start) && isMidnight(end)) {
    const lastDay = addDays(end, -1);
    return start.getTime() === startOfDay(lastDay).getTime()
      ? shortDay(start) + ", toute la journée"
      : "du " + shortDay(start) + " au " + shortDay(lastDay);
  }
  const minutes = (date: Date) => date.getHours() * 60 + date.getMinutes();
  return shortDay(start) + ", " + minutesToTime(minutes(start)) + "–" + minutesToTime(minutes(end));
}

/**
 * The closed stretches of `day`, as clock minutes (0–1440) — drawn over the
 * agenda's day column. Read off the clock, not counted from midnight, so they
 * line up with the bookings on the days the clocks change.
 */
export function closureBlocksForDay(
  closures: TimeOff[],
  day: Date,
): { startMinute: number; endMinute: number; label: string }[] {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(startOfDay(day), 1).getTime();
  const clockMinutes = (date: Date) => date.getHours() * 60 + date.getMinutes();
  return closures
    .filter(
      (closure) =>
        new Date(closure.startsAt).getTime() < dayEnd &&
        new Date(closure.endsAt).getTime() > dayStart,
    )
    .map((closure) => {
      const start = new Date(closure.startsAt);
      const end = new Date(closure.endsAt);
      return {
        startMinute: start.getTime() <= dayStart ? 0 : clockMinutes(start),
        endMinute: end.getTime() >= dayEnd ? 1440 : clockMinutes(end),
        label: closure.label,
      };
    });
}
