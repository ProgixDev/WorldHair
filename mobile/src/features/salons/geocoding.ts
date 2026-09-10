import { MAPBOX_TOKEN } from "./mapProvider";

/**
 * Real, worldwide city search via Mapbox's Geocoding API — the same public
 * token already used for the map (`EXPO_PUBLIC_MAPBOX_PK`), reached as a
 * plain HTTPS call so it works even where the native Mapbox map itself
 * doesn't (Expo Go). No new service/account needed.
 *
 * Deliberately not restricted to any country: the "Choisir une ville" picker
 * used to only ever offer the 8 French cities the salon catalogue happens to
 * be seeded in — real to look at, but not a real search. This searches
 * anywhere. Picking a city with no nearby salons yet is still an honest
 * result (the existing empty state on /discover already reads correctly),
 * not a reason to hide the rest of the world from the picker.
 */

const GEOCODING_ENDPOINT = "https://api.mapbox.com/search/geocode/v6/forward";

export interface CitySuggestion {
  /** Stable enough to use as a list key — not meaningful beyond that. */
  id: string;
  label: string;
  /** Region/country under the name, e.g. "Île-de-France, France". */
  subtitle: string | null;
  latitude: number;
  longitude: number;
}

interface MapboxFeature {
  properties: {
    mapbox_id?: string;
    name?: string;
    place_formatted?: string;
  };
  geometry: {
    coordinates: [number, number]; // [longitude, latitude]
  };
}

interface MapboxForwardGeocodeResponse {
  features?: MapboxFeature[];
}

/** True only when a Mapbox token is actually configured — see mapProvider.ts. */
export const CITY_SEARCH_AVAILABLE = Boolean(MAPBOX_TOKEN);

/**
 * Searches for cities/towns matching `query`. `signal` lets the caller
 * cancel an in-flight request once a newer keystroke supersedes it — plain
 * "ignore the stale response" isn't enough here, since without aborting, a
 * slow early request can still resolve *after* a faster later one and
 * overwrite it with outdated suggestions.
 */
export async function searchCities(
  query: string,
  signal?: AbortSignal,
): Promise<CitySuggestion[]> {
  if (!MAPBOX_TOKEN || query.trim().length === 0) return [];

  const params = new URLSearchParams({
    q: query.trim(),
    access_token: MAPBOX_TOKEN,
    types: "place",
    autocomplete: "true",
    language: "fr",
    limit: "6",
  });

  const response = await fetch(`${GEOCODING_ENDPOINT}?${params.toString()}`, {
    signal,
  });
  if (!response.ok) return [];

  const data = (await response.json()) as MapboxForwardGeocodeResponse;

  return (data.features ?? [])
    .filter((feature) => feature.properties.name)
    .map((feature, index) => ({
      id: feature.properties.mapbox_id ?? `${feature.properties.name}-${index}`,
      label: feature.properties.name!,
      subtitle: feature.properties.place_formatted ?? null,
      longitude: feature.geometry.coordinates[0],
      latitude: feature.geometry.coordinates[1],
    }));
}
