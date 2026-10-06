import { relativeDay, timeOfDay } from "../../utils/date";
import type { ProAppointment } from "./types";

/**
 * The end-of-service code as the salon's screens use it (TODO.md): the link
 * the QR holds, when to ask for a new code, and whether a booking can show
 * one. Pure, so it's tested without a screen. The server stays the judge —
 * `canShowCompletionCode` only keeps the button from offering what it
 * would refuse.
 */

/** A code lives 5 minutes (server/src/appointments/presence.service.ts); the app swaps it before it runs out. */
const REFRESH_LEAD_MS = 60_000;
/** Floor for the wait: a clock out of step with the server must not turn renewals into a loop. */
const MIN_REFRESH_DELAY_MS = 5_000;
/** The server shows a code until this long after the booking's end. */
const AFTER_END_MS = 12 * 3_600_000;

/**
 * The website's « /rdv/CODE » page (web/src/app/rdv): it opens the app on
 * the client's confirmation — what the QR code holds, so the phone's own
 * camera is enough to scan it. `null` when this build has no website address.
 */
export function presenceLink(code: string, base: string | undefined = process.env.EXPO_PUBLIC_WEB_URL): string | null {
  const root = base?.trim().replace(/\/+$/, "");
  return root ? root + "/rdv/" + code : null;
}

/** How long to wait before asking for a new code: about a minute before this one expires, never zero or less. */
export function codeRefreshDelayMs(expiresAt: string, now: Date = new Date()): number {
  const remaining = new Date(expiresAt).getTime() - now.getTime();
  // An unreadable date: ask again soon rather than never.
  if (!Number.isFinite(remaining)) return MIN_REFRESH_DELAY_MS;
  return Math.max(MIN_REFRESH_DELAY_MS, remaining - REFRESH_LEAD_MS);
}

/** "Valable encore 4 min" — rounded up, so it never reads « 0 min » while the code still works. */
export function codeValidityLabel(expiresAt: string, now: Date = new Date()): string {
  const remaining = new Date(expiresAt).getTime() - now.getTime();
  const minutes = Number.isFinite(remaining) ? Math.max(1, Math.ceil(remaining / 60_000)) : 1;
  return "Valable encore " + minutes + " min";
}

/**
 * « Afficher le code de fin »: an accepted booking (the list calls it
 * « done » once it's over) from its start until 12 hours after its end,
 * the client not marked absent and not yet confirmed. A manual « Honoré »
 * doesn't hide it: the code is what proves the client was there.
 */
export function canShowCompletionCode(appointment: ProAppointment, now: Date = new Date()): boolean {
  if (appointment.status !== "confirmed" && appointment.status !== "done") return false;
  if (appointment.attendance === "no_show" || appointment.confirmedByClientAt) return false;
  const start = new Date(appointment.startsAt).getTime();
  const end = start + appointment.durationMin * 60_000;
  return start <= now.getTime() && now.getTime() <= end + AFTER_END_MS;
}

/** "Confirmé par le client · Aujourd'hui à 14:32" */
export function confirmedLabel(confirmedAt: string, now: Date = new Date()): string {
  const date = new Date(confirmedAt);
  return "Confirmé par le client · " + relativeDay(date, now) + " à " + timeOfDay(date);
}
