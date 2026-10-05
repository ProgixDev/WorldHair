import type { MySubscription, PlanId, PlanPrice, SubscriptionTier } from "@/services/proApi";

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
  const summary = summarize(subscription);
  const running = ["trialing", "active", "ending", "past_due"].includes(subscription.state);
  if (running && !subscription.listed && !subscription.offered) {
    summary.detail +=
      " Votre salon n'est pas encore visible : terminez sa fiche dans l'application (photo, horaires) pour apparaître dans la recherche.";
  }
  return summary;
}

function summarize(subscription: MySubscription): SubscriptionSummary {
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
        detail: `Premier prélèvement le ${longDate(subscription.trialEndsAt)}.`,
        tone: "ok",
      };
    case "active":
      return subscription.offered
        ? {
            title: "Abonnement offert",
            detail: `Votre salon est en ligne jusqu'au ${longDate(subscription.endsAt)}. En vous abonnant dès maintenant, cette période offerte est conservée : le premier prélèvement n'aura lieu qu'à sa fin.`,
            tone: "ok",
          }
        : {
            title: "Abonnement actif",
            detail: `Renouvellement automatique le ${longDate(subscription.currentPeriodEnd)}.`,
            tone: "ok",
          };
    case "ending":
      return {
        title: "Abonnement résilié",
        detail: `Il prend fin le ${longDate(subscription.endsAt)}. Vous pouvez encore changer d'avis.`,
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

/** The two formulas, as the website names them. */
export const TIER_INFO: Record<SubscriptionTier, { name: string; tagline: string }> = {
  solo: { name: "Solo", tagline: "Vous seul·e dans votre salon" },
  team: { name: "Équipe", tagline: "Jusqu'à 5 personnes, vous compris : un agenda par coiffeur" },
};

/** The order the formulas are offered in. */
export const TIERS: readonly SubscriptionTier[] = ["solo", "team"];

/** The Mensuel / Annuel toggle. */
export const PLAN_NAMES: Record<PlanId, string> = { monthly: "Mensuel", yearly: "Annuel" };

/** « Équipe · annuelle » — a formula and its billing period on one line (admin list); an offered one has no billing period. */
export function formulaLabel(tier: SubscriptionTier, plan: PlanId, offered = false): string {
  const period = offered ? "offerte" : plan === "yearly" ? "annuelle" : "mensuelle";
  return `${TIER_INFO[tier].name} · ${period}`;
}

/** "Formule Équipe · Annuelle · jusqu'à 5 personnes"; `null` before a first subscription. */
export function describeFormula(subscription: MySubscription): string | null {
  if (subscription.state === "none") return null;
  const parts = [`Formule ${TIER_INFO[subscription.tier].name}`];
  // An offered subscription isn't billed, so it has no billing period to speak of.
  if (!subscription.offered) parts.push(subscription.plan === "yearly" ? "Annuelle" : "Mensuelle");
  parts.push(subscription.teamLimit > 1 ? `jusqu'à ${subscription.teamLimit} personnes` : "vous seul·e");
  return parts.join(" · ");
}

export function formatEuros(amount: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export function priceFor(
  prices: readonly PlanPrice[] | null,
  tier: SubscriptionTier,
  plan: PlanId,
): PlanPrice | undefined {
  return prices?.find((price) => price.tier === tier && price.plan === plan);
}

export interface PriceDisplay {
  /** What one month costs on this plan: "19,99 €". */
  perMonth: string;
  /** "facturé 239,88 € par an"; `null` on a monthly plan, which is billed every month. */
  billing: string | null;
}

/** A yearly price is shown per month, with what is actually billed once a year. */
export function describePrice(price: PlanPrice): PriceDisplay {
  if (price.plan === "monthly") return { perMonth: formatEuros(price.amount, price.currency), billing: null };
  // Whole cents: the yearly price needn't divide evenly by twelve.
  const perMonth = Math.round((price.amount * 100) / 12) / 100;
  return {
    perMonth: formatEuros(perMonth, price.currency),
    billing: `facturé ${formatEuros(price.amount, price.currency)} par an`,
  };
}

/** What the first charge will be, after the free days; empty when there are none. */
export function trialSentence(trialDays: number, price: PlanPrice): string {
  if (trialDays <= 0) return "";
  const days = trialDays === 1 ? "1 jour" : `${trialDays} jours`;
  const period = price.plan === "yearly" ? "par an" : "par mois";
  return `${days} d'essai gratuit, puis ${formatEuros(price.amount, price.currency)} ${period}.`;
}

/** "2 mois offerts": what the yearly plan saves against twelve monthly payments, in whole months. */
export function yearlySaving(monthly: number, yearly: number): string | null {
  // Whole cents: (29,99 × 12 − 269,91) / 29,99 comes to 2,9999… in floating point, though it is exactly three.
  const monthlyCents = Math.round(monthly * 100);
  const savedCents = monthlyCents * 12 - Math.round(yearly * 100);
  const months = Math.floor(savedCents / monthlyCents);
  if (months < 1) return null;
  return months > 1 ? `${months} mois offerts` : "1 mois offert";
}

/** The saving of one tier's yearly plan, from the prices the API lists — each tier has its own. */
export function tierSaving(prices: readonly PlanPrice[] | null, tier: SubscriptionTier): string | null {
  const monthly = priceFor(prices, tier, "monthly");
  const yearly = priceFor(prices, tier, "yearly");
  return monthly && yearly ? yearlySaving(monthly.amount, yearly.amount) : null;
}

/**
 * Where the website's sign-in lands: a coiffeur may come back to the pro
 * page they were sent to (by email). `next` is resolved like the browser
 * would — dot segments included — so it can only ever stay under /pro/ on
 * this site.
 */
export function landingAfterSignIn(role: "admin" | "coiffeur", next: string | null): string {
  if (role === "admin") return "/admin";
  if (!next) return "/pro/abonnement";
  const base = "https://worldhair.invalid";
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return "/pro/abonnement";
  }
  return url.origin === base && url.pathname.startsWith("/pro/") ? url.pathname + url.search : "/pro/abonnement";
}
