import type { Salon } from "./types";

/**
 * Placeholder cover art. The onboarding photographs stand in until real salon
 * photos exist — swap this map when the backend serves image URLs.
 */
const COVERS: Record<Salon["cover"], number> = {
  portrait: require("../../../assets/images/OnBoarding/OnBoarding1.png"),
  styles: require("../../../assets/images/OnBoarding/OnBoarding2.png"),
  storefront: require("../../../assets/images/OnBoarding/OnBoarding3.png"),
};

export function coverFor(salon: Pick<Salon, "cover">): number {
  return COVERS[salon.cover];
}

/** Warm editorial palette, picked deterministically so a salon keeps its hue. */
const ACCENTS = ["#d8b48a", "#b9855a", "#8c9a7d", "#c98a7a", "#7f92ad"];

export function accentFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++)
    hash = (hash * 31 + id.charCodeAt(i)) % 997;
  return ACCENTS[hash % ACCENTS.length];
}

/** "Maison Tresse" → "MT" */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}
