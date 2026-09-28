/**
 * Where Stripe's payment sheet brings the client back to the app after a
 * bank's check (3-D Secure) done outside it — on iOS; Android's SDK has its
 * own way back.
 */
export const STRIPE_RETURN_URL = "worldhair://stripe-redirect";

/** Stripe's return link belongs to its SDK: no screen should open for it. */
export function isStripeReturnUrl(url: string): boolean {
  return url.includes("stripe-redirect");
}
