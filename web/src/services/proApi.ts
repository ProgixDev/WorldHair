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

export type PlanId = "monthly" | "yearly";

/** Mirrors server/src/subscriptions/subscriptions.service.ts's SubscriptionView. */
export interface MySubscription {
  state: SubscriptionState;
  plan: PlanId;
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
  plan: PlanId;
  /** Euros, TTC. */
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
export async function startCheckout(plan: PlanId): Promise<string> {
  const { data } = await apiClient.post<{ url: string }>("/subscriptions/checkout-session", { plan });
  return data.url;
}

/** Stripe's Customer Portal: plan, card, invoices, cancellation. */
export async function openCustomerPortal(): Promise<string> {
  const { data } = await apiClient.post<{ url: string }>("/subscriptions/portal-session");
  return data.url;
}
