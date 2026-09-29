import * as WebBrowser from "expo-web-browser";

/**
 * The CGU and privacy policy this build shows (TODO.md Phase 8): the date
 * they took effect, recorded at sign-up. Whether an account must accept
 * again is the server's call (server/src/users/terms.ts, TermsGate), so an
 * older build never loops on a version it doesn't know.
 */
export const TERMS_VERSION = "2026-09-29";

export type LegalPage = "cgu" | "confidentialite" | "mentions-legales";

export const LEGAL_PAGES: { page: LegalPage; label: string }[] = [
  { page: "cgu", label: "Conditions générales d'utilisation" },
  { page: "confidentialite", label: "Politique de confidentialité" },
  { page: "mentions-legales", label: "Mentions légales" },
];

/** The website's page (EXPO_PUBLIC_WEB_URL); null when the address isn't set. */
export function legalPageUrl(page: LegalPage, base: string | undefined = process.env.EXPO_PUBLIC_WEB_URL): string | null {
  const root = base?.trim().replace(/\/+$/, "");
  return root ? `${root}/${page}` : null;
}

/** Opens it in the in-app browser. */
export async function openLegalPage(page: LegalPage): Promise<void> {
  const url = legalPageUrl(page);
  if (url) await WebBrowser.openBrowserAsync(url);
}
