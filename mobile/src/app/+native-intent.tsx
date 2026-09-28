import { isPaymentReturnUrl } from "../features/payments/paymentReturn";

/**
 * Links coming into the app, before Expo Router opens a screen for them.
 * The way back from Stripe's payment page is for the booking screen, which
 * is waiting for it, not a screen: an empty path opens nothing (the home
 * screen on a cold start).
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string {
  if (isPaymentReturnUrl(path)) return initial ? "/" : "";
  return path;
}
