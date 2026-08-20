/**
 * Small French date helpers. Hand-rolled rather than `toLocaleDateString`,
 * which needs a full-ICU Hermes build to be trusted on every Android device.
 */

const DAYS_SHORT = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
const DAYS_LONG = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];
const MONTHS_SHORT = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];
const MONTHS_LONG = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "lun." */
export function weekdayShort(date: Date): string {
  return DAYS_SHORT[date.getDay()] + ".";
}

/** "lundi" */
export function weekdayLong(date: Date): string {
  return DAYS_LONG[date.getDay()];
}

/** "24 août" */
export function dayAndMonth(date: Date): string {
  return date.getDate() + " " + MONTHS_SHORT[date.getMonth()];
}

/** "lundi 24 août 2026" */
export function fullDate(date: Date): string {
  return (
    weekdayLong(date) +
    " " +
    date.getDate() +
    " " +
    MONTHS_LONG[date.getMonth()] +
    " " +
    date.getFullYear()
  );
}

/** "août 2026" */
export function monthAndYear(date: Date): string {
  return MONTHS_LONG[date.getMonth()] + " " + date.getFullYear();
}

/** "14:30" */
export function timeOfDay(date: Date): string {
  return (
    String(date.getHours()).padStart(2, "0") +
    ":" +
    String(date.getMinutes()).padStart(2, "0")
  );
}

/** Minutes from midnight → "09:30". */
export function minutesToTime(minutes: number): string {
  return (
    String(Math.floor(minutes / 60)).padStart(2, "0") +
    ":" +
    String(minutes % 60).padStart(2, "0")
  );
}

/** "Aujourd'hui" / "Demain" / "lun. 24 août" */
export function relativeDay(date: Date, now = new Date()): string {
  if (isSameDay(date, now)) return "Aujourd'hui";
  if (isSameDay(date, addDays(now, 1))) return "Demain";
  return weekdayShort(date) + " " + dayAndMonth(date);
}

/** "il y a 3 jours" / "il y a 2 mois" — for review timestamps. */
export function timeAgo(iso: string, now = new Date()): string {
  const days = Math.floor(
    (startOfDay(now).getTime() - startOfDay(new Date(iso)).getTime()) / DAY_MS,
  );
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 30) return "il y a " + days + " jours";
  const months = Math.round(days / 30);
  if (months < 12) return "il y a " + months + " mois";
  const years = Math.round(months / 12);
  return "il y a " + years + (years > 1 ? " ans" : " an");
}

/** "1 h 30" / "45 min" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return minutes + " min";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? hours + " h"
    : hours + " h " + String(rest).padStart(2, "0");
}

/** "45 €" — no decimals, French spacing. */
export function formatPrice(euros: number): string {
  return euros + " €";
}
