import type { ConfirmationMode } from "./types";

/**
 * A salon's booking rules as the client reads them — on the salon page and
 * the booking recap. The coiffeur sets them in "Mon salon"; the server
 * enforces them (server/src/appointments/booking-rules.ts).
 */

/** "30 min", "1 h", "12 h", "1 jour", "2 jours" — how the presets read. */
export function formatNotice(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days + (days > 1 ? " jours" : " jour");
  }
  if (minutes >= 60 && minutes % 60 === 0) return minutes / 60 + " h";
  return minutes + " min";
}

export function bookingRuleLines(rules: {
  bookingNoticeMinutes: number;
  cancellationNoticeMinutes: number;
  confirmationMode: ConfirmationMode;
}): string[] {
  return [
    rules.bookingNoticeMinutes > 0
      ? "Réservable jusqu'à " + formatNotice(rules.bookingNoticeMinutes) + " avant"
      : "Réservable jusqu'au dernier moment",
    rules.cancellationNoticeMinutes > 0
      ? "Annulation ou modification jusqu'à " + formatNotice(rules.cancellationNoticeMinutes) + " avant"
      : "Annulation ou modification à tout moment",
    rules.confirmationMode === "instant" ? "Confirmation immédiate" : "Le salon confirme chaque demande",
  ];
}
