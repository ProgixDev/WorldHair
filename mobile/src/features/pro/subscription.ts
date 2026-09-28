import { fullDate } from "../../utils/date";
import type { ProAppointment, Subscription } from "./types";

/**
 * Pure reads of the coiffeur's subscription for the J-7 banner, the account
 * tab and the end-of-subscription block (issue #8). The app only states
 * facts: subscribing and paying happen outside it, and App Store rule
 * 3.1.3(f) forbids pointing there from inside (the emails do that).
 */

/** Whole days before the salon leaves search; `null` while it renews on its own. */
export function daysRemaining(subscription: Subscription, now = new Date()): number | null {
  if (!subscription.endsAt) return null;
  return Math.ceil((new Date(subscription.endsAt).getTime() - now.getTime()) / 86_400_000);
}

/** J-7 warning window: an end date 7 days away or less. */
export function isNearingExpiry(subscription: Subscription, now = new Date()): boolean {
  const days = daysRemaining(subscription, now);
  return days !== null && days >= 0 && days <= 7;
}

/**
 * Ended: the pro area is blocked. A salon that never subscribed isn't — its
 * coiffeur still has to set up the salon before going online.
 */
export function isSubscriptionExpired(subscription: Subscription): boolean {
  return subscription.state === "expired";
}

/** Bookings and requests still set after the end date: they'd outlive the salon's listing. */
export function countBookingsAfterEnd(subscription: Subscription, appointments: ProAppointment[]): number {
  if (!subscription.endsAt) return 0;
  const end = new Date(subscription.endsAt).getTime();
  return appointments.filter(
    (appointment) =>
      (appointment.status === "confirmed" || appointment.status === "pending") &&
      new Date(appointment.startsAt).getTime() >= end,
  ).length;
}

export interface SubscriptionSummary {
  title: string;
  detail: string;
  tone: "ok" | "warning" | "danger";
}

function on(iso: string | null): string {
  return iso ? fullDate(new Date(iso)) : "—";
}

/** The status line shared by the dashboard strip and the account tab. */
export function describeSubscription(
  subscription: Subscription,
  now = new Date(),
  /** Bookings still set after `endsAt`: the coiffeur should cancel or move them before then. */
  context: { bookingsAfterEnd?: number } = {},
): SubscriptionSummary {
  const summary = summarize(subscription, now);
  const after = context.bookingsAfterEnd ?? 0;
  if (subscription.endsAt && after > 0) {
    summary.detail +=
      " " + after + (after > 1 ? " rendez-vous sont prévus" : " rendez-vous est prévu") +
      " après cette date : pensez à les annuler ou à les déplacer.";
  }
  return summary;
}

function summarize(subscription: Subscription, now: Date): SubscriptionSummary {
  const days = daysRemaining(subscription, now);
  if (days !== null && isNearingExpiry(subscription, now)) {
    return {
      title: "Il vous reste " + days + (days > 1 ? " jours" : " jour") + " d'abonnement",
      detail: "Votre fiche sera masquée le " + on(subscription.endsAt) + ".",
      tone: "danger",
    };
  }

  switch (subscription.state) {
    case "none":
      return {
        title: "Fiche pas encore en ligne",
        detail: "Aucun abonnement actif : votre salon n'apparaît pas encore dans la recherche.",
        tone: "warning",
      };
    case "trialing":
      return {
        title: "Essai gratuit",
        detail: "Jusqu'au " + on(subscription.trialEndsAt) + " : premier prélèvement ce jour-là.",
        tone: "ok",
      };
    case "active":
      return subscription.offered
        ? {
            title: "Abonnement offert",
            detail: "Votre fiche est visible jusqu'au " + on(subscription.endsAt) + ".",
            tone: "ok",
          }
        : {
            title: "Abonnement actif",
            detail: "Renouvellement automatique le " + on(subscription.currentPeriodEnd) + ".",
            tone: "ok",
          };
    case "ending":
      return {
        title: "Abonnement résilié",
        detail: "Votre fiche reste visible jusqu'au " + on(subscription.endsAt) + ", puis sera masquée.",
        tone: "warning",
      };
    case "past_due":
      return {
        title: "Paiement refusé",
        detail: "Le prélèvement de votre abonnement a échoué ; il sera retenté dans les prochains jours. Votre fiche reste visible en attendant.",
        tone: "danger",
      };
    case "incomplete":
      return {
        title: "Paiement en attente",
        detail: "Le premier paiement n'est pas encore confirmé : votre fiche n'est pas encore visible.",
        tone: "warning",
      };
    case "expired":
      return {
        title: "Abonnement terminé",
        detail: "Votre fiche n'est plus visible par les clients.",
        tone: "danger",
      };
  }
}
