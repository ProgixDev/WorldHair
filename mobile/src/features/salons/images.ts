import type { ImageSourcePropType } from "react-native";

/**
 * Imagery layer. No backend serves photos yet, so covers come from a curated
 * remote pool, galleries from a deterministic placeholder service and reviewer
 * avatars from a face generator. Every URL is derived from an id, so a salon
 * keeps the same pictures across launches. Swap this module when the API
 * returns real media.
 */

const UNSPLASH = "https://images.unsplash.com/photo-";
const UNSPLASH_QUERY = "?auto=format&fit=crop&q=70";

/** Verified photo ids — salon, hair and portrait subjects. */
const COVER_IDS = [
  "1560066984-138dadb4c035",
  "1522337360788-8b13dee7a37e",
  "1521590832167-7bcbfaa6381f",
  "1600948836101-f9ffda59d250",
  "1580618672591-eb180b1a973f",
  "1519699047748-de8e457a634e",
  "1562322140-8baeececf3df",
  "1596178065887-1198b6148b2b",
  "1595476108010-b4d1f102b1b1",
  "1503951914875-452162b0f3f1",
  "1493256338651-d82f7acb2b38",
  "1621607512214-68297480165e",
  "1552642986-ccb41e7059e7",
  "1633681926022-84c23e8cb2d6",
  "1616394584738-fc6e612e71b9",
  "1554519515-242161756769",
  "1517832606299-7ae9b720a186",
  "1487412947147-5cebf100ffc2",
];

/** Bundled art, used as the offline fallback and for the onboarding slides. */
export const BUNDLED_COVERS: ImageSourcePropType[] = [
  require("../../../assets/images/OnBoarding/OnBoarding1.png"),
  require("../../../assets/images/OnBoarding/OnBoarding2.png"),
  require("../../../assets/images/OnBoarding/OnBoarding3.png"),
];

/** Stable hash so a given id always resolves to the same picture. */
function hash(value: string): number {
  let out = 0;
  for (let i = 0; i < value.length; i++)
    out = (out * 31 + value.charCodeAt(i)) % 99991;
  return out;
}

export function coverUrl(id: string, width = 800): string {
  const photo = COVER_IDS[hash(id) % COVER_IDS.length];
  return UNSPLASH + photo + UNSPLASH_QUERY + "&w=" + width;
}

/** Cover for a salon card / hero. */
export function coverFor(salon: { id: string }, width = 800) {
  return { uri: coverUrl(salon.id, width) };
}

/** Offline stand-in shown while the remote cover loads or if it fails. */
export function coverPlaceholder(id: string): ImageSourcePropType {
  return BUNDLED_COVERS[hash(id) % BUNDLED_COVERS.length];
}

/** Work-gallery strip on the salon page — always distinct per slot. */
export function galleryFor(salonId: string, count = 8): { uri: string }[] {
  return Array.from({ length: count }, (_, index) => ({
    uri:
      "https://picsum.photos/seed/" +
      encodeURIComponent(salonId + "-" + index) +
      "/500/500",
  }));
}

/** Deterministic face for a review author. */
export function avatarFor(name: string, salonId = ""): { uri: string } {
  return {
    uri:
      "https://i.pravatar.cc/160?u=" + encodeURIComponent(name + "|" + salonId),
  };
}

/** Warm editorial palette, picked deterministically so a salon keeps its hue. */
const ACCENTS = ["#d8b48a", "#b9855a", "#8c9a7d", "#c98a7a", "#7f92ad"];

export function accentFor(id: string): string {
  return ACCENTS[hash(id) % ACCENTS.length];
}

/** "Maison Tresse" → "MT" */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}
