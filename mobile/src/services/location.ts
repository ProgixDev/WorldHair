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
    // Passive read (app boot) — never show a system dialog unprompted, so
    // this stays a plain services-on check rather than letting
    // getCurrentPositionAsync's own settings-resolution flow fire.
    return readPosition({ allowSettingsPrompt: false });
  } catch {
    return fallback("error");
  }
}

/**
 * Prompts if needed, then resolves the device position. User-initiated
 * (the "Activer" button) — this is the one path that's allowed to trigger
 * Android's native "turn on Location" system dialog when services are off.
 */
export async function requestPosition(): Promise<LocationResult> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return fallback("denied", permission.canAskAgain);
    return readPosition({ allowSettingsPrompt: true });
  } catch {
    return fallback("error");
  }
}

async function readPosition({
  allowSettingsPrompt,
}: {
  allowSettingsPrompt: boolean;
}): Promise<LocationResult> {
  try {
    if (!allowSettingsPrompt) {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) return fallback("disabled");
    }

    // Last known first — it returns instantly and is accurate enough to rank
    // salons; the fresh fix follows only when there is nothing cached.
    //
    // On the active path, deliberately NOT pre-checking hasServicesEnabledAsync
    // and bailing out on our own: getCurrentPositionAsync's Android
    // implementation already shows the real system "turn on Location" dialog
    // itself when services are off (mayShowUserSettingsDialog, on by
    // default) and waits for the user's answer. Short-circuiting to the
    // Paris fallback before that ever runs — the previous bug here — meant
    // tapping "Activer" silently did nothing once permission was granted:
    // no permission dialog left to show, and the settings dialog never got
    // the chance to fire either.
    const position =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: allowSettingsPrompt,
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
    // Covers both an unexpected read failure and the user declining the
    // settings-resolution dialog above — either way, still no position.
    return fallback("error");
  }
}
