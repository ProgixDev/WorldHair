import * as Location from "expo-location";
import { PARIS_CENTER, type Coordinates } from "../features/salons/geo";

export type LocationStatus =
  | "unknown" // not asked yet
  | "granted"
  | "denied"
  | "disabled" // permission fine, device location services off
  | "error";

export interface LocationResult {
  status: LocationStatus;
  /** Real position when granted, otherwise the Paris fallback. */
  coords: Coordinates;
  /** True while `coords` is the fallback rather than the device position. */
  isFallback: boolean;
  /** False once the OS stops offering the prompt (user must open settings). */
  canAskAgain: boolean;
}

function fallback(status: LocationStatus, canAskAgain = true): LocationResult {
  return { status, coords: PARIS_CENTER, isFallback: true, canAskAgain };
}

/** Reads the current permission without prompting. */
export async function peekPermission(): Promise<LocationResult> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted)
      return fallback(
        permission.canAskAgain ? "unknown" : "denied",
        permission.canAskAgain,
      );
    return readPosition();
  } catch {
    return fallback("error");
  }
}

/** Prompts if needed, then resolves the device position. */
export async function requestPosition(): Promise<LocationResult> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return fallback("denied", permission.canAskAgain);
    return readPosition();
  } catch {
    return fallback("error");
  }
}

async function readPosition(): Promise<LocationResult> {
  try {
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) return fallback("disabled");

    // Last known first — it returns instantly and is accurate enough to rank
    // salons; the fresh fix follows only when there is nothing cached.
    const position =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }));

    return {
      status: "granted",
      coords: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
      isFallback: false,
      canAskAgain: true,
    };
  } catch {
    return fallback("error");
  }
}
