import { addDays, isSameDay, minutesToTime, relativeDay, timeOfDay, weekdayShort } from "../../utils/date";
import type { Coordinates } from "./geo";
import { dateKey } from "./slots";
import type { SpecialtyId } from "./types";

export type SalonSort = "distance" | "rating" | "price" | "availability";
export type PracticeZone = "salon" | "domicile";

/**
 * What the client narrows the search with. The server does all of it
 * (GET /salons): no salon goes missing past a download cap.
 */
export interface SalonFilters {
  query: string;
  specialties: SpecialtyId[];
  /** Kilometres; `null` means no distance cap. */
  maxDistanceKm: number | null;
  sort: SalonSort;
  /** A visible prestation within the range, euros; `null` = no bound. */
  priceMin: number | null;
  priceMax: number | null;
  /** "now": open right now; a YYYY-MM-DD day: open that day; `null`: any time. */
  openWhen: "now" | string | null;
  /** Minutes after midnight: still open after it — on `openWhen`'s day, or any day. */
  openAfter: number | null;
  /** In a salon, or coming to the client's home; `null`: both. */
  practiceZone: PracticeZone | null;
}

export const DEFAULT_FILTERS: SalonFilters = {
  query: "",
  specialties: [],
  maxDistanceKm: null,
  sort: "distance",
  priceMin: null,
  priceMax: null,
  openWhen: null,
  openAfter: null,
  practiceZone: null,
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
  { value: "availability", label: "Disponible au plus tôt" },
  { value: "rating", label: "Mieux notés" },
  { value: "price", label: "Prix croissant" },
];

export const PRICE_OPTIONS: { min: number | null; max: number | null; label: string }[] = [
  { min: null, max: 30, label: "Moins de 30 €" },
  { min: 30, max: 60, label: "30 à 60 €" },
  { min: 60, max: 100, label: "60 à 100 €" },
  { min: 100, max: null, label: "Plus de 100 €" },
];

/** "Ouvert après": minutes after midnight. */
export const OPEN_AFTER_OPTIONS: { value: number; label: string }[] = [
  { value: 12 * 60, label: "12 h" },
  { value: 17 * 60, label: "17 h" },
  { value: 19 * 60, label: "19 h" },
];

export const PRACTICE_ZONE_OPTIONS: { value: PracticeZone | null; label: string }[] = [
  { value: null, label: "Tous" },
  { value: "salon", label: "En salon" },
  { value: "domicile", label: "À domicile" },
];

/** The map's visible area: minLat, minLng, maxLat, maxLng. */
export type MapBounds = [number, number, number, number];

/** GET /salons's query parameters for these filters, a page, and the map's area when it's the map asking. */
export function searchParams(
  filters: SalonFilters,
  from: Coordinates | null,
  page: { limit: number; offset: number },
  bounds?: MapBounds,
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  if (from) {
    params.lat = from.latitude;
    params.lng = from.longitude;
    if (filters.maxDistanceKm !== null) params.radiusKm = filters.maxDistanceKm;
  }
  const query = filters.query.trim();
  if (query) params.query = query;
  if (filters.specialties.length > 0) params.specialties = filters.specialties.join(",");
  if (filters.sort !== "distance") params.sort = filters.sort;
  if (filters.priceMin !== null) params.priceMin = filters.priceMin;
  if (filters.priceMax !== null) params.priceMax = filters.priceMax;
  if (filters.openWhen === "now") params.openNow = true;
  else if (filters.openWhen) params.openOn = filters.openWhen;
  if (filters.openAfter !== null) params.openAfter = minutesToTime(filters.openAfter);
  if (filters.practiceZone) params.practiceZone = filters.practiceZone;
  if (bounds) params.bounds = bounds.join(",");
  params.limit = page.limit;
  params.offset = page.offset;
  return params;
}

/** How many filters are active — drives the badge on the filter button. */
export function activeFilterCount(filters: SalonFilters): number {
  return (
    filters.specialties.length +
    (filters.maxDistanceKm !== null ? 1 : 0) +
    (filters.sort !== DEFAULT_FILTERS.sort ? 1 : 0) +
    (filters.priceMin !== null || filters.priceMax !== null ? 1 : 0) +
    (filters.openWhen !== null ? 1 : 0) +
    (filters.openAfter !== null ? 1 : 0) +
    (filters.practiceZone !== null ? 1 : 0)
  );
}

/** The "Quand" chips: today, tomorrow, then the next days by name — keys are local YYYY-MM-DD. */
export function dayOptions(count: number, now = new Date()): { key: string; label: string }[] {
  return Array.from({ length: count }, (_, offset) => {
    const day = addDays(now, offset);
    const label = offset === 0 ? "Aujourd'hui" : offset === 1 ? "Demain" : weekdayShort(day) + " " + day.getDate();
    return { key: dateKey(day), label };
  });
}

/** "Dispo aujourd'hui 14:30" · "Dispo demain 09:00" · "Dispo ven. 2 oct. 10:30" — a salon's next free time on a card. */
export function nextSlotLabel(iso: string, now = new Date()): string {
  const slot = new Date(iso);
  const day = isSameDay(slot, now) ? "aujourd'hui" : isSameDay(slot, addDays(now, 1)) ? "demain" : relativeDay(slot, now);
  return "Dispo " + day + " " + timeOfDay(slot);
}

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
