/**
 * The website's "Mon abonnement" page (web/src/app/pro/abonnement): where
 * Stripe sends coiffeurs back and where subscription emails point.
 * `null` while WEB_APP_URL isn't set.
 */
export function subscriptionPageUrl(webAppUrl: string | undefined): string | null {
  const base = (webAppUrl ?? '').trim().replace(/\/+$/, '');
  return base ? `${base}/pro/abonnement` : null;
}
