import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  onboardingSeen: "@worldhair/onboarding_seen",
  locationIntent: "@worldhair/location_intent",
} as const;

/** How the user chose to find salons on the last onboarding slide. */
export type LocationIntent = "gps" | "manual";

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEYS.onboardingSeen)) === "true";
  } catch {
    return false;
  }
}

export async function setOnboardingSeen(seen = true): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.onboardingSeen, seen ? "true" : "false");
  } catch {
    // Preference loss is not worth blocking the flow over.
  }
}

export async function getLocationIntent(): Promise<LocationIntent | null> {
  try {
    const value = await AsyncStorage.getItem(KEYS.locationIntent);
    return value === "gps" || value === "manual" ? value : null;
  } catch {
    return null;
  }
}

export async function setLocationIntent(intent: LocationIntent): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.locationIntent, intent);
  } catch {
    // ignore
  }
}

/** Wipes onboarding state — used by the dev reset action. */
export async function clearPreferences(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([KEYS.onboardingSeen, KEYS.locationIntent]);
  } catch {
    // ignore
  }
}
