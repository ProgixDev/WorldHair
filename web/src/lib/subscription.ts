import type { MySubscription } from "@/services/proApi";

export interface SubscriptionSummary {
  title: string;
  detail: string;
  tone: "ok" | "warning" | "danger";
}

function longDate(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Europe/Paris",
      })
    : "—";
}

/** The status block of the website's "Mon abonnement" page. */
export function describeMySubscription(subscription: MySubscription): SubscriptionSummary {
  if (subscription.awaitingValidation && subscription.state === "none") {
    return {
      title: "Dossier en cours de validation",
      detail: "Vous pourrez choisir votre abonnement dès que l'équipe WorldHair aura validé votre dossier.",
      tone: "warning",
    };
  }
  switch (subscription.state) {
    case "none":
      return {
        title: "Votre salon n'est pas encore en ligne",
        detail: "Choisissez votre formule pour apparaître dans la recherche et recevoir des réservations.",
        tone: "warning",
      };
    case "trialing":
      return {
        title: "Essai gratuit en cours",
        detail: `Votre salon est en ligne. Premier prélèvement le ${longDate(subscription.trialEndsAt)}.`,
        tone: "ok",
      };
    case "active":
      return subscription.offered
        ? {
            title: "Abonnement offert",
            detail: `Votre salon est en ligne jusqu'au ${longDate(subscription.endsAt)}. Abonnez-vous pour le garder ensuite.`,
            tone: "ok",
          }
        : {
            title: "Abonnement actif",
            detail: `Votre salon est en ligne. Renouvellement automatique le ${longDate(subscription.currentPeriodEnd)}.`,
            tone: "ok",
          };
    case "ending":
      return {
        title: "Abonnement résilié",
        detail: `Votre salon reste en ligne jusqu'au ${longDate(subscription.endsAt)}. Vous pouvez encore changer d'avis.`,
        tone: "warning",
      };
    case "past_due":
      return {
        title: "Paiement refusé",
        detail: "Le dernier prélèvement a échoué et sera retenté. Mettez à jour votre carte pour garder votre salon en ligne.",
        tone: "danger",
      };
    case "incomplete":
      return {
        title: "Paiement en attente",
        detail: "Votre premier paiement n'a pas été confirmé. Relancez l'abonnement pour réessayer.",
        tone: "warning",
      };
    case "expired":
      return {
        title: "Abonnement terminé",
        detail: "Votre salon n'est plus visible par les clients. Réabonnez-vous pour le remettre en ligne.",
        tone: "danger",
      };
  }
}

/** "2 mois offerts": what the yearly plan saves against twelve monthly payments, in whole months. */
export function yearlySaving(monthly: number, yearly: number): string | null {
  const months = Math.floor((monthly * 12 - yearly) / monthly);
  if (months < 1) return null;
  return months > 1 ? `${months} mois offerts` : "1 mois offert";
}

/** Where the website's sign-in lands: a coiffeur may come back to a pro page they were sent to (by email). */
export function landingAfterSignIn(role: "admin" | "coiffeur", next: string | null): string {
  if (role === "admin") return "/admin";
  return next && next.startsWith("/pro/") ? next : "/pro/abonnement";
}
