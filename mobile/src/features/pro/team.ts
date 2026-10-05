import { isAxiosError } from "axios";
import { dayAndMonth, minutesToTime, timeOfDay, weekdayLong, weekdayShort } from "../../utils/date";
import type { AvailabilityDay, SalonInvite, StaffMember, TimeOff } from "./types";

/**
 * The salon's team as the owner reads it in « Équipe » (TODO.md Phase 3):
 * names, each person's week in a few words, the invite message he sends,
 * and why the server refused to remove someone. Pure, so it's tested
 * without a screen.
 */

/** The French week starts on Monday; the server's weekdays start on Sunday (0). */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** "lun." for weekday 1 — 16 Aug 2026 is a Sunday (as in AvailabilityRow). */
function shortWeekday(weekday: number): string {
  return weekdayShort(new Date(2026, 7, 16 + weekday));
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function memberName(person: Pick<StaffMember, "firstName" | "lastName">): string {
  return `${person.firstName} ${person.lastName}`.trim() || "Sans nom";
}

/**
 * One line for the team list: « Horaires du salon » for someone without
 * their own week, else their days ("Mar.–sam.", "Lun., mer., ven.") and
 * hours ("09:00–19:00", or « horaires variables » when the days differ).
 */
export function weekSummary(days: AvailabilityDay[] | null): string {
  if (!days) return "Horaires du salon";
  const open = WEEK_ORDER.map((weekday) => days.find((item) => item.weekday === weekday && item.open)).filter(
    (item): item is AvailabilityDay => Boolean(item),
  );
  if (open.length === 0) return "Aucun jour travaillé";

  // Runs of days in a row, Monday first; three or more read as a range.
  const runs: AvailabilityDay[][] = [];
  for (const item of open) {
    const run = runs[runs.length - 1];
    const previous = run?.[run.length - 1];
    if (previous && WEEK_ORDER.indexOf(item.weekday) === WEEK_ORDER.indexOf(previous.weekday) + 1) run.push(item);
    else runs.push([item]);
  }
  const dayNames = runs
    .map((run) =>
      run.length >= 3
        ? shortWeekday(run[0].weekday) + "–" + shortWeekday(run[run.length - 1].weekday)
        : run.map((item) => shortWeekday(item.weekday)).join(", "),
    )
    .join(", ");

  const sameHours = open.every((item) => item.opens === open[0].opens && item.closes === open[0].closes);
  const hours = sameHours
    ? minutesToTime(open[0].opens) + "–" + minutesToTime(open[0].closes)
    : "horaires variables";
  return capitalize(dayNames) + " · " + hours;
}

/**
 * The week the owner edits for one person: their own days, or — the first
 * time — a copy of the salon's, which a booking has to fit anyway. In the
 * salon's order, like the agenda's « Horaires » sheet.
 */
export function weekToEdit(own: AvailabilityDay[] | null, salon: AvailabilityDay[]): AvailabilityDay[] {
  return salon.map((salonDay) => ({ ...(own?.find((item) => item.weekday === salonDay.weekday) ?? salonDay) }));
}

/** Whether an edited week is what's stored; a first personal week (`stored` null) always counts as a change. */
export function sameWeek(draft: AvailabilityDay[], stored: AvailabilityDay[] | null): boolean {
  if (!stored || stored.length !== draft.length) return false;
  return draft.every((item) => {
    const other = stored.find((candidate) => candidate.weekday === item.weekday);
    return (
      other !== undefined &&
      other.open === item.open &&
      other.opens === item.opens &&
      other.closes === item.closes &&
      other.breakStart === item.breakStart &&
      other.breakEnd === item.breakEnd
    );
  });
}

/** « Équipe » in the account tab: "Vous seul", "3 personnes". */
export function teamSizeLabel(team: StaffMember[]): string {
  return team.length <= 1 ? "Vous seul" : team.length + " personnes";
}

/** Turning this person's bookings off would leave none of the team for clients to book. */
export function nobodyElseTakesBookings(team: StaffMember[], staffId: string): boolean {
  return !team.some((person) => person.id !== staffId && person.takesBookings);
}

/** One person's congés, or — `null` — the closures of the whole salon. */
export function closuresOf(timeOff: TimeOff[], staffId: string | null): TimeOff[] {
  return timeOff.filter((closure) => (closure.staffId ?? null) === staffId);
}

/** "lundi 12 oct. à 14:32" — a code lasts a week, so no year. */
function until(expiresAt: string): string {
  const date = new Date(expiresAt);
  return weekdayLong(date) + " " + dayAndMonth(date) + " à " + timeOfDay(date);
}

/** "Valable jusqu'au lundi 12 oct. à 14:32" */
export function inviteValidity(expiresAt: string): string {
  return "Valable jusqu'au " + until(expiresAt);
}

/**
 * The website's « /rejoindre/CODE » page (web/src/app/rejoindre): it opens
 * the app on « Rejoindre un salon » with the code in — what the QR code
 * holds. `null` when this build has no website address.
 */
export function inviteLink(code: string, base: string | undefined = process.env.EXPO_PUBLIC_WEB_URL): string | null {
  const root = base?.trim().replace(/\/+$/, "");
  return root ? root + "/rejoindre/" + code : null;
}

/** What the owner sends by WhatsApp or SMS: the link, the code for whoever types it, until when. */
export function inviteShareMessage(
  salonName: string,
  invite: SalonInvite,
  base: string | undefined = process.env.EXPO_PUBLIC_WEB_URL,
): string {
  const link = inviteLink(invite.code, base);
  return (
    "Rejoignez " +
    (salonName.trim() || "mon salon") +
    " sur WorldHair : " +
    // A space before the comma: messaging apps would take it into the link.
    (link ? "ouvrez " + link + " , ou dans l'app choisissez" : "téléchargez l'app, choisissez") +
    " « Coiffeur › Rejoindre un salon » et entrez le code " +
    invite.code +
    " (valable jusqu'au " +
    until(invite.expiresAt) +
    ")."
  );
}

/** Why the server kept someone in the team, in French; `null` for any other failure (the generic message then). */
export function removeStaffRefusal(err: unknown): string | null {
  if (!isAxiosError(err)) return null;
  const body = err.response?.data as { message?: unknown } | undefined;
  const message = typeof body?.message === "string" ? body.message : "";
  if (err.response?.status === 409 && message.startsWith("STAFF_HAS_BOOKINGS")) {
    return "Des rendez-vous à venir lui sont attribués : donnez-les à quelqu'un d'autre depuis l'agenda, puis réessayez.";
  }
  if (err.response?.status === 400 && message.includes("owner")) {
    return "Le propriétaire du salon ne peut pas être retiré de l'équipe.";
  }
  return null;
}
