import type { Subscription } from "./types";

/**
 * Pure derivations for the J-7 banner and end-of-subscription block (issue
 * #8). "active" auto-renews and never counts down; "trial" and "cancelled"
 * both have a real end date the coiffeur can lose access at.
 */

function isCountingDown(subscription: Subscription): boolean {
  return subscription.status === "trial" || subscription.status === "cancelled";
}

/** The date access stops if nothing changes — trial end, or last paid day. */
export function subscriptionEndsAt(subscription: Subscription): Date {
  const iso =
    subscription.status === "trial" && subscription.trialEndsAt
      ? subscription.trialEndsAt
      : subscription.renewsAt;
  return new Date(iso);
}

/** Whole days left before `subscriptionEndsAt`, negative once past it. */
export function daysRemaining(
  subscription: Subscription,
  now = new Date(),
): number {
  const ms = subscriptionEndsAt(subscription).getTime() - now.getTime();
  return Math.ceil(ms / 86400000);
}

/** J-7 warning window: still counting down, 7 days or fewer left. */
export function isNearingExpiry(
  subscription: Subscription,
  now = new Date(),
): boolean {
  if (!isCountingDown(subscription)) return false;
  const days = daysRemaining(subscription, now);
  return days >= 0 && days <= 7;
}

/** Past the end date with nothing renewing it — the app should block access. */
export function isSubscriptionExpired(
  subscription: Subscription,
  now = new Date(),
): boolean {
  return isCountingDown(subscription) && daysRemaining(subscription, now) < 0;
}
