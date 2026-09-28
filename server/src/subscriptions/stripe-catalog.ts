import type { SubscriptionPlan } from './subscription-state';

/**
 * What scripts/stripe-setup.ts creates in Stripe and the server looks up —
 * by lookup key and metadata, so switching Stripe accounts (test → live)
 * needs no id in the env. Plain constants: the setup script imports them
 * without loading Nest.
 */
export const PLAN_LOOKUP_KEYS: Record<SubscriptionPlan, string> = {
  monthly: 'worldhair_pro_monthly',
  yearly: 'worldhair_pro_yearly',
};

/** `metadata.app` on the product and the Customer Portal settings the script makes. */
export const PORTAL_CONFIGURATION_APP = 'worldhair';
