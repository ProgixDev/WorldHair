import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  onboardingSeen: "@worldhair/onboarding_seen",
  locationIntent: "@worldhair/location_intent",
  notifications: "@worldhair/notifications",
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
 * optional and everything else mandatory, so only these two are stored.
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
  try {
    const raw = await AsyncStorage.getItem(KEYS.notifications);
    if (!raw) return DEFAULT_NOTIFICATIONS;
    return { ...DEFAULT_NOTIFICATIONS, ...(JSON.parse(raw) as object) };
  } catch {
    return DEFAULT_NOTIFICATIONS;
  }
}

export async function setNotificationPrefs(
  prefs: NotificationPrefs,
): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.notifications, JSON.stringify(prefs));
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
      KEYS.notifications,
    ]);
  } catch {
    // ignore
  }
}
