import { apiClient } from "@/lib/apiClient";

/** Mirrors server/src/subscriptions/subscription-state.ts's SubscriptionState. */
export type SubscriptionState =
  | "none"
  | "trialing"
  | "active"
  | "ending"
  | "past_due"
  | "incomplete"
  | "expired";

/** The billing period; the tier (formula) is separate. */
export type PlanId = "monthly" | "yearly";

/** The two formulas: « Solo » (the owner alone) and « Équipe » (up to 5 people, owner included). */
export type SubscriptionTier = "solo" | "team";

/** Mirrors server/src/subscriptions/subscriptions.service.ts's SubscriptionView. */
export interface MySubscription {
  state: SubscriptionState;
  plan: PlanId;
  tier: SubscriptionTier;
  /** People the salon may have working in it, owner included: 1 (Solo) or 5 (Équipe). */
  teamLimit: number;
  /** Visible in search and bookable right now. */
  listed: boolean;
  /** Offered without Stripe (demo salons, launch partners). */
  offered: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  /** When the salon leaves search if nothing changes; `null` while it renews on its own. */
  endsAt: string | null;
  /** Stripe's Customer Portal can open. */
  canManage: boolean;
  /** The admin hasn't validated the application yet: subscribing comes after. */
  awaitingValidation: boolean;
  /** Checkout can start. */
  canSubscribe: boolean;
  /** Free days a Checkout would start with. */
  trialDays: number;
}

export interface PlanPrice {
  tier: SubscriptionTier;
  plan: PlanId;
  /** Euros, TTC; for a yearly plan, the price of the whole year. */
  amount: number;
  currency: string;
}

export async function getMySubscription(): Promise<MySubscription> {
  const { data } = await apiClient.get<MySubscription>("/subscriptions/mine");
  return data;
}

export async function listPlanPrices(): Promise<PlanPrice[]> {
  const { data } = await apiClient.get<PlanPrice[]>("/subscriptions/prices");
  return data;
}

/** Stripe Checkout's URL — the card is typed on Stripe's page, never on ours. */
export async function startCheckout(tier: SubscriptionTier, plan: PlanId): Promise<string> {
  const { data } = await apiClient.post<{ url: string }>("/subscriptions/checkout-session", { tier, plan });
  return data.url;
}

/** Stripe's Customer Portal: formula, billing period, card, invoices, cancellation. */
export async function openCustomerPortal(): Promise<string> {
  const { data } = await apiClient.post<{ url: string }>("/subscriptions/portal-session");
  return data.url;
}
