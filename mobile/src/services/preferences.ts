import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient } from "../lib/apiClient";

const KEYS = {
  onboardingSeen: "@worldhair/onboarding_seen",
  locationIntent: "@worldhair/location_intent",
  signupIntent: "@worldhair/signup_intent",
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

/**
 * Reminder switches. The cahier des charges makes the J-1 and H-1 reminders
 * optional and everything else mandatory, so only these two are stored —
 * real now (server/src/notifications/), same shape as the request/response.
 */
export interface NotificationPrefs {
  reminderDayBefore: boolean;
  reminderHourBefore: boolean;
}

export const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  reminderDayBefore: true,
  reminderHourBefore: true,
};

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const { data } = await apiClient.get<NotificationPrefs>("/notifications/preferences");
  return data;
}

export async function setNotificationPrefs(
  prefs: NotificationPrefs,
): Promise<void> {
  await apiClient.patch("/notifications/preferences", prefs);
}

/**
 * Which role the user picked on the sign-up screen — read once, right after
 * email verification, to decide whether a freshly-verified account (still
 * `role: "particulier"` in the database; only submitting a coiffeur
 * application flips that server-side) lands in the coiffeur wizard instead
 * of particulier profile-setup. Not read anywhere else: an existing
 * coiffeur's real `session.role` is what routing.ts uses everywhere after.
 */
export type SignupIntent = "particulier" | "coiffeur";

export async function getSignupIntent(): Promise<SignupIntent | null> {
  try {
    const value = await AsyncStorage.getItem(KEYS.signupIntent);
    return value === "particulier" || value === "coiffeur" ? value : null;
  } catch {
    return null;
  }
}

export async function setSignupIntent(intent: SignupIntent): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.signupIntent, intent);
  } catch {
    // ignore
  }
}

export async function clearSignupIntent(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.signupIntent);
  } catch {
    // ignore
  }
}

/** Wipes onboarding state — used by the dev reset action. */
export async function clearPreferences(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      KEYS.onboardingSeen,
      KEYS.locationIntent,
      KEYS.signupIntent,
    ]);
  } catch {
    // ignore
  }
}
