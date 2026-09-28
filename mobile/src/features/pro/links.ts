export type SocialNetwork = "instagram" | "facebook" | "tiktok" | "website";

/** Where a bare handle leads, per network. */
const PROFILE_URL: Record<Exclude<SocialNetwork, "website">, (handle: string) => string> = {
  instagram: (handle) => "https://instagram.com/" + handle,
  facebook: (handle) => "https://facebook.com/" + handle,
  tiktok: (handle) => "https://www.tiktok.com/@" + handle,
};

const DOMAINS: Record<Exclude<SocialNetwork, "website">, RegExp> = {
  instagram: /instagram\.com/i,
  facebook: /(facebook|fb)\.com/i,
  tiktok: /tiktok\.com/i,
};

/**
 * What the coiffeur typed as the link the server takes (it checks each
 * points to its own site): a full link kept, https:// added when left out,
 * an @handle turned into the network's page; "" for none.
 */
export function socialLink(network: SocialNetwork, typed: string): string {
  const value = typed.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (network === "website" || DOMAINS[network].test(value)) return "https://" + value;
  return PROFILE_URL[network](value.replace(/^@/, ""));
}
