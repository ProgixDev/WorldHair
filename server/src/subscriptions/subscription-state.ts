/**
 * What a coiffeur's `coiffeur_subscriptions` row means (TODO.md Phase 4).
 * The subscription itself lives in Stripe; the row mirrors it through
 * Stripe's webhooks. A row with no Stripe subscription is an offered one
 * (seeded demo salons, launch partners), good until `current_period_end`.
 */

import type { SubscriptionTier } from './tiers';

/** The billing period; the tier (Solo or Équipe) is separate. */
export type SubscriptionPlan = 'monthly' | 'yearly';

/** Stripe's own subscription statuses, word for word; 'none' before any Checkout. */
export type StripeSubscriptionStatus =
  | 'none'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

/** How the app and the website present it. */
export type SubscriptionState =
  | 'none'
  | 'trialing'
  | 'active'
  /** A cancellation is scheduled: listed until `cancel_at`. */
  | 'ending'
  /** A payment failed and Stripe retries it: still listed meanwhile. */
  | 'past_due'
  /** The first payment awaits the coiffeur's confirmation (3-D Secure...): not listed yet. */
  | 'incomplete'
  | 'expired';

export interface SubscriptionRow {
  profile_id: string;
  plan: SubscriptionPlan;
  /** What the salon pays for (TODO.md Phase 3): Solo, or Équipe. */
  tier: SubscriptionTier;
  status: StripeSubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  /** A scheduled cancellation (the Customer Portal's "cancel at period end"). */
  cancel_at: string | null;
}

const LIVE_STATUSES: StripeSubscriptionStatus[] = ['trialing', 'active', 'past_due'];

/**
 * Stripe moves the period on at every renewal, even a failing one, so a
 * period over for longer than Stripe's 3 days of webhook retries means the
 * news stopped coming (endpoint disabled, secret changed): the status is no
 * longer trusted.
 */
export const STRIPE_SILENCE_GRACE_MS = 3 * 86_400_000;

export function isLiveStatus(status: StripeSubscriptionStatus): boolean {
  return LIVE_STATUSES.includes(status);
}

function isOffered(row: SubscriptionRow): boolean {
  return row.stripe_subscription_id === null;
}

/**
 * Visible in search and bookable. Mirrors search_salons()'s join in
 * schema.sql: Stripe keeps a live subscription's status current (while its
 * period isn't long over), an offered one runs until its end date.
 */
export function isListed(row: SubscriptionRow | null, now = new Date()): boolean {
  if (!row || !isLiveStatus(row.status)) return false;
  const periodEnd = row.current_period_end === null ? null : new Date(row.current_period_end).getTime();
  if (!isOffered(row)) return periodEnd === null || periodEnd > now.getTime() - STRIPE_SILENCE_GRACE_MS;
  return periodEnd !== null && periodEnd > now.getTime();
}

export function subscriptionState(row: SubscriptionRow | null, now = new Date()): SubscriptionState {
  if (!row || row.status === 'none') return 'none';
  if (isOffered(row)) return isListed(row, now) ? 'active' : 'expired';
  switch (row.status) {
    case 'trialing':
    case 'active':
      return row.cancel_at ? 'ending' : row.status;
    case 'past_due':
    case 'incomplete':
      return row.status;
    default:
      return 'expired';
  }
}

/** When the salon stops being listed if nothing changes; `null` while it renews on its own. */
export function subscriptionEndsAt(row: SubscriptionRow | null, now = new Date()): string | null {
  const state = subscriptionState(row, now);
  if (!row) return null;
  if (state === 'ending') return row.cancel_at;
  if (state === 'active' && isOffered(row)) return row.current_period_end;
  return null;
}
