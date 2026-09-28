import { fullDate } from "../../utils/date";
import type { Subscription } from "./types";

/**
 * Pure reads of the coiffeur's subscription for the J-7 banner, the account
 * tab and the end-of-subscription block (issue #8). The app only shows it:
 * subscribing, paying and cancelling happen on the website.
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

export interface SubscriptionSummary {
  title: string;
  detail: string;
  tone: "ok" | "warning" | "danger";
}

function on(iso: string | null): string {
  return iso ? fullDate(new Date(iso)) : "—";
}

/** The status line shared by the dashboard strip and the account tab. */
export function describeSubscription(subscription: Subscription, now = new Date()): SubscriptionSummary {
  const days = daysRemaining(subscription, now);
  if (days !== null && isNearingExpiry(subscription, now)) {
    return {
      title: "Il vous reste " + days + (days > 1 ? " jours" : " jour") + " d'abonnement",
      detail: "Votre fiche sera masquée le " + on(subscription.endsAt) + ". Nous vous avons envoyé par email la marche à suivre pour la garder.",
      tone: "danger",
    };
  }

  switch (subscription.state) {
    case "none":
      return {
        title: "Fiche pas encore en ligne",
        detail: "Votre salon apparaîtra dans la recherche dès que votre abonnement sera actif. Nous vous avons envoyé par email la marche à suivre.",
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
        detail: "Le prélèvement de votre abonnement a échoué et sera retenté. Vérifiez votre carte bancaire : nous vous avons envoyé un email.",
        tone: "danger",
      };
    case "incomplete":
      return {
        title: "Paiement en attente",
        detail: "Votre premier paiement attend votre confirmation. Votre fiche sera visible dès qu'il sera validé.",
        tone: "warning",
      };
    case "expired":
      return {
        title: "Abonnement terminé",
        detail: "Votre fiche n'est plus visible par les clients. Nous vous avons envoyé par email la marche à suivre pour la remettre en ligne.",
        tone: "danger",
      };
  }
}
