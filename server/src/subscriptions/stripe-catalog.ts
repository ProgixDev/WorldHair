import type { SubscriptionPlan } from './subscription-state';
import type { SubscriptionTier } from './tiers';

/**
 * What scripts/stripe-setup.ts creates in Stripe and the server looks up —
 * by lookup key and metadata, so switching Stripe accounts (test → live)
 * needs no id in the env. Plain constants: the setup script imports them
 * without loading Nest. A product per tier (« WorldHair Solo », « WorldHair
 * Équipe »), each with a monthly and a yearly price.
 */
export const PLAN_LOOKUP_KEYS: Record<SubscriptionTier, Record<SubscriptionPlan, string>> = {
  solo: { monthly: 'worldhair_solo_monthly', yearly: 'worldhair_solo_yearly' },
  team: { monthly: 'worldhair_team_monthly', yearly: 'worldhair_team_yearly' },
};

/** `metadata.app` on the products and the Customer Portal settings the script makes. */
export const PORTAL_CONFIGURATION_APP = 'worldhair';
