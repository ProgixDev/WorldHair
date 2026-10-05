/**
 * The two formulas a salon subscribes to (TODO.md Phase 3): « Solo », the
 * owner alone, and « Équipe », up to five people in all, owner included.
 * Each has a monthly and a yearly price in Stripe (stripe-catalog.ts).
 */
export type SubscriptionTier = 'solo' | 'team';

export const SUBSCRIPTION_TIERS: readonly SubscriptionTier[] = ['solo', 'team'];

/** People a salon may have working in it, its owner included. */
export const TEAM_LIMITS: Record<SubscriptionTier, number> = { solo: 1, team: 5 };

/** A salon with no subscription yet, or one from before tiers, works alone. */
export function teamLimitOf(row: { tier?: SubscriptionTier } | null): number {
  return TEAM_LIMITS[row?.tier ?? 'solo'];
}

/** The tier a Stripe price belongs to, from its lookup key; the old single price (`worldhair_pro_*`) was Solo's. */
export function tierOfLookupKey(lookupKey: string | null | undefined): SubscriptionTier {
  return lookupKey?.startsWith('worldhair_team_') ? 'team' : 'solo';
}
