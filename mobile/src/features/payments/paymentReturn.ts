/**
 * Where the website sends the client back to the app once they paid on
 * Stripe's page, or gave up (web/src/app/paiement/retour). The booking
 * screen waits for it; no screen opens for it (src/app/+native-intent.tsx).
 */
export const PAYMENT_RETURN_URL = "worldhair://paiement-retour";

export function isPaymentReturnUrl(url: string): boolean {
  return url.includes("paiement-retour");
}
