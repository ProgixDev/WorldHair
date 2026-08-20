import type { Salon, SalonWithDistance } from "./types";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Fallback position while the user has not granted location (Paris centre). */
export const PARIS_CENTER: Coordinates = {
  latitude: 48.8606,
  longitude: 2.3376,
};

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in kilometres. */
export function haversineKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** "450 m" under a kilometre, "1,2 km" above — French decimal comma. */
export function formatDistance(km: number): string {
  if (km < 1) return Math.round(km * 100) * 10 + " m";
  if (km < 10) return km.toFixed(1).replace(".", ",") + " km";
  return Math.round(km) + " km";
}

export function withDistance(
  salons: Salon[],
  from: Coordinates,
): SalonWithDistance[] {
  return salons.map((salon) => ({
    ...salon,
    distanceKm: haversineKm(from, {
      latitude: salon.latitude,
      longitude: salon.longitude,
    }),
  }));
}

/**
 * Map region that frames every salon passed in, with a margin so pins never
 * sit on the very edge.
 */
export function regionForSalons(
  salons: SalonWithDistance[],
  center: Coordinates,
) {
  if (salons.length === 0)
    return { ...center, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  const lats = salons.map((s) => s.latitude).concat(center.latitude);
  const lons = salons.map((s) => s.longitude).concat(center.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.02),
    longitudeDelta: Math.max((maxLon - minLon) * 1.6, 0.02),
  };
}
