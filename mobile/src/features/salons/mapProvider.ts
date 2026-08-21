import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Which map engine actually renders, decided at runtime.
 *
 * - iOS uses Apple Maps: no key, always works.
 * - Android needs a Google Maps API key. Expo Go ships its own, so the map
 *   works there out of the box; a dev/production build uses the key from
 *   `app.config.js` (env var `GOOGLE_MAPS_API_KEY`).
 * - Without a valid key we do NOT show a grey rectangle: the Google base layer
 *   is switched off (`mapType="none"`) and OpenStreetMap raster tiles are drawn
 *   instead, so the feature keeps working while the key is being sorted out.
 */

/**
 * Expo strips `android.config` from the public manifest, so the key itself is
 * never readable at runtime. `app.config.js` publishes a boolean instead.
 */
export const HAS_GOOGLE_MAPS_KEY = Boolean(
  Constants.expoConfig?.extra?.googleMapsConfigured,
);

/** Expo Go supplies its own Google key, so no fallback is needed there. */
export const IS_EXPO_GO = Constants.executionEnvironment === "storeClient";

/**
 * Mapbox public token (pk.*), inlined at build time from
 * `EXPO_PUBLIC_MAPBOX_PK`. It is meant to ship inside the app; the secret
 * download token (sk.*) never leaves the build machine.
 */
const rawMapboxToken = process.env.EXPO_PUBLIC_MAPBOX_PK;
export const MAPBOX_TOKEN =
  typeof rawMapboxToken === "string" && rawMapboxToken.startsWith("pk.")
    ? rawMapboxToken
    : null;

/**
 * Mapbox needs its native module, so it is unavailable in Expo Go — the app
 * silently uses react-native-maps there.
 */
export const MAPBOX_ENABLED = Boolean(MAPBOX_TOKEN) && !IS_EXPO_GO;

/**
 * Android build without a Google key → draw OpenStreetMap tiles ourselves.
 * Irrelevant once Mapbox is active, since it brings its own tiles.
 */
export const USE_OSM_TILES =
  Platform.OS === "android" &&
  !HAS_GOOGLE_MAPS_KEY &&
  !IS_EXPO_GO &&
  !MAPBOX_ENABLED;

/**
 * Raster tile template. openstreetmap.org is fine for development; a
 * production app should move to its own Google key or a commercial tile host
 * (MapTiler, Stadia…) to respect the OSM tile usage policy.
 */
export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/** Shown over the map whenever OSM tiles are used — required attribution. */
export const OSM_ATTRIBUTION = "© OpenStreetMap";

/** Human-readable engine name, for the settings/diagnostics rows. */
export function mapEngineLabel(): string {
  if (MAPBOX_ENABLED) return "Mapbox";
  if (Platform.OS === "ios") return "Apple Plans";
  if (USE_OSM_TILES) return "OpenStreetMap (sans clé)";
  return IS_EXPO_GO ? "Google Maps (clé Expo Go)" : "Google Maps";
}

/** Longer, engine-aware explanation for the diagnostics row's detail sheet. */
export function mapEngineDetail(): string {
  if (MAPBOX_ENABLED)
    return "Rendu vectoriel Mapbox, activé via EXPO_PUBLIC_MAPBOX_PK.";
  if (Platform.OS === "ios") return "Plans natifs d'Apple, sans clé requise.";
  if (USE_OSM_TILES)
    return "Aucune clé Google Maps configurée : tuiles OpenStreetMap affichées à la place. Renseignez GOOGLE_MAPS_API_KEY (ou EXPO_PUBLIC_MAPBOX_PK pour Mapbox) puis relancez le build natif.";
  return IS_EXPO_GO
    ? "Google Maps via la clé intégrée à Expo Go."
    : "Google Maps avec la clé GOOGLE_MAPS_API_KEY du projet.";
}
