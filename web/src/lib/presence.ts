/**
 * The link the salon's end-of-service QR code carries: « /rdv/CODE » on this
 * site, which hands over to the app (mobile/src/app/rdv/[code].tsx). The code
 * is spent by the app, never by this page: opening the link proves nothing.
 */

/** Twelve letters or digits, as the server makes them — `null` for anything else. */
export function normalizePresenceCode(raw: string): string | null {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // A broken escape: read as is, it fails the shape check below.
  }
  const code = decoded.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z0-9]{12}$/.test(code) ? code : null;
}

/** The app's own link (mobile/src/app/rdv/[code].tsx). */
export function presenceAppUrl(code: string): string {
  return `worldhair://rdv/${code}`;
}
