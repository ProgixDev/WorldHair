/**
 * The website's "Mon abonnement" page (web/src/app/pro/abonnement): where
 * Stripe sends coiffeurs back and where subscription emails point.
 * `null` while WEB_APP_URL isn't set.
 */
export function subscriptionPageUrl(webAppUrl: string | undefined): string | null {
  const base = (webAppUrl ?? '').trim().replace(/\/+$/, '');
  return base ? `${base}/pro/abonnement` : null;
}

/**
 * Where Stripe's payment page sends a client back once they paid for a
 * booking, or gave up (web/src/app/paiement/retour): it hands over to the
 * app. `null` while WEB_APP_URL isn't set.
 */
export function paymentReturnPageUrl(webAppUrl: string | undefined): string | null {
  const base = (webAppUrl ?? '').trim().replace(/\/+$/, '');
  return base ? `${base}/paiement/retour` : null;
}
