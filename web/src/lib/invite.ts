/**
 * The link a salon owner shares to bring a coiffeur into his team (TODO.md
 * Phase 3): « /rejoindre/CODE » on this site, which hands over to the app's
 * « Rejoindre un salon » with the code filled in.
 */

/** Six letters or digits, as the server makes them — `null` for anything else. */
export function normalizeInviteCode(raw: string): string | null {
  const code = decodeURIComponent(raw).trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}

/** The app's own link (mobile/src/app/rejoindre/[code].tsx). */
export function inviteAppUrl(code: string): string {
  return `worldhair://rejoindre/${code}`;
}

export interface InviteInfo {
  code: string;
  salonName: string;
  expiresAt: string;
}

/** Which salon the code joins, or `null` when it's unknown, used or expired (GET /staff/invites/:code, public). */
export async function fetchInvite(code: string): Promise<InviteInfo | null> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return null;
  try {
    const response = await fetch(`${base}/staff/invites/${encodeURIComponent(code)}`, { cache: "no-store" });
    return response.ok ? ((await response.json()) as InviteInfo) : null;
  } catch {
    return null;
  }
}
