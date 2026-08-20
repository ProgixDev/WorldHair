import type { SalonWithDistance, SpecialtyId } from "./types";

export type SalonSort = "distance" | "rating" | "price";

export interface SalonFilters {
  query: string;
  specialties: SpecialtyId[];
  /** Kilometres; `null` means no distance cap. */
  maxDistanceKm: number | null;
  sort: SalonSort;
}

export const DEFAULT_FILTERS: SalonFilters = {
  query: "",
  specialties: [],
  maxDistanceKm: null,
  sort: "distance",
};

export const DISTANCE_OPTIONS: { value: number | null; label: string }[] = [
  { value: 1, label: "1 km" },
  { value: 3, label: "3 km" },
  { value: 5, label: "5 km" },
  { value: 10, label: "10 km" },
  { value: null, label: "Partout" },
];

export const SORT_OPTIONS: { value: SalonSort; label: string }[] = [
  { value: "distance", label: "Au plus proche" },
  { value: "rating", label: "Mieux notés" },
  { value: "price", label: "Prix croissant" },
];

const ACCENTS: Record<string, string> = {
  à: "a",
  â: "a",
  ä: "a",
  ç: "c",
  é: "e",
  è: "e",
  ê: "e",
  ë: "e",
  î: "i",
  ï: "i",
  ô: "o",
  ö: "o",
  ù: "u",
  û: "u",
  ü: "u",
};

/** Lowercase + strip accents by table (no reliance on Intl/ICU in Hermes). */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .split("")
    .map((char) => ACCENTS[char] ?? char)
    .join("");
}

function matchesQuery(salon: SalonWithDistance, query: string): boolean {
  const q = normalize(query.trim());
  if (q.length === 0) return true;
  const haystack = normalize(
    [
      salon.name,
      salon.stylist,
      salon.tagline,
      salon.city,
      salon.postalCode,
      salon.addressLine,
      ...salon.services.map((service) => service.name),
    ].join(" "),
  );
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

/** Pure pipeline: text → specialties → distance cap → sort. */
export function applyFilters(
  salons: SalonWithDistance[],
  filters: SalonFilters,
): SalonWithDistance[] {
  const filtered = salons.filter((salon) => {
    if (!matchesQuery(salon, filters.query)) return false;
    if (
      filters.specialties.length > 0 &&
      !filters.specialties.some((id) => salon.specialties.includes(id))
    )
      return false;
    if (
      filters.maxDistanceKm !== null &&
      salon.distanceKm > filters.maxDistanceKm
    )
      return false;
    return true;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (filters.sort === "rating") return b.rating - a.rating;
    if (filters.sort === "price") return a.priceFrom - b.priceFrom;
    return a.distanceKm - b.distanceKm;
  });
  return sorted;
}

/** How many filters are active — drives the badge on the filter button. */
export function activeFilterCount(filters: SalonFilters): number {
  return (
    filters.specialties.length +
    (filters.maxDistanceKm !== null ? 1 : 0) +
    (filters.sort !== DEFAULT_FILTERS.sort ? 1 : 0)
  );
}
