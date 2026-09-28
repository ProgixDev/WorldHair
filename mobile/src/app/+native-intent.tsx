import { isStripeReturnUrl } from "../features/payments/stripeReturn";

/**
 * Links coming into the app, before Expo Router opens a screen for them.
 * Stripe's return link after a bank's check (3-D Secure) is for Stripe's
 * SDK, not a screen: an empty path opens nothing (the home screen on a cold
 * start), and useStripeReturnLinks (_layout.tsx) hands it to Stripe.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string {
  if (isStripeReturnUrl(path)) return initial ? "/" : "";
  return path;
}
