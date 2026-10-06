import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient } from "../lib/apiClient";

const KEYS = {
  onboardingSeen: "@worldhair/onboarding_seen",
  locationIntent: "@worldhair/location_intent",
  signupIntent: "@worldhair/signup_intent",
  /** The code from the owner's QR code or link (TODO.md Phase 3), until it's used. */
  pendingJoinCode: "@worldhair/pending_join_code",
  /** The « code de fin » scanned while signed out (app/rdv/[code].tsx), until the client shell resumes it. */
  pendingPresenceCode: "@worldhair/pending_presence_code",
  manualCity: "@worldhair/manual_city",
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
 * The city picked via "Choisir une ville" (onboarding's location slide or
 * `/discover`'s own picker) — persisted so it survives an app restart rather
 * than resetting to the Paris fallback every launch. Only consulted while
 * GPS isn't granted (see LocationContext's init effect): live GPS always
 * wins over a possibly-stale saved city once permission exists.
 */
export interface ManualCity {
  label: string;
  latitude: number;
  longitude: number;
}

export async function getManualCity(): Promise<ManualCity | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.manualCity);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ManualCity>;
    if (
      typeof parsed.label !== "string" ||
      typeof parsed.latitude !== "number" ||
      typeof parsed.longitude !== "number"
    ) {
      return null;
    }
    return { label: parsed.label, latitude: parsed.latitude, longitude: parsed.longitude };
  } catch {
    return null;
  }
}

export async function setManualCity(city: ManualCity): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.manualCity, JSON.stringify(city));
  } catch {
    // ignore
  }
}

export async function clearManualCity(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.manualCity);
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
 * application, or joining a salon, flips that server-side) lands in the
 * coiffeur wizard (« Créer mon salon ») or on « Rejoindre un salon »
 * (`staff`, TODO.md Phase 3) instead of particulier profile-setup. Not read
 * anywhere else: an existing coiffeur's or staff member's real
 * `session.role` is what routing.ts uses everywhere after.
 */
export type SignupIntent = "particulier" | "coiffeur" | "staff";

export async function getSignupIntent(): Promise<SignupIntent | null> {
  try {
    const value = await AsyncStorage.getItem(KEYS.signupIntent);
    return value === "particulier" || value === "coiffeur" || value === "staff" ? value : null;
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

/** The code from the owner's QR code or link (app/rejoindre/[code].tsx), kept through sign-up for « Rejoindre un salon ». */
export async function getPendingJoinCode(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEYS.pendingJoinCode);
  } catch {
    return null;
  }
}

export async function setPendingJoinCode(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.pendingJoinCode, code);
  } catch {
    // Not kept: the code is typed by hand instead.
  }
}

export async function clearPendingJoinCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.pendingJoinCode);
  } catch {
    // ignore
  }
}

/** The « code de fin » of a booking, scanned before signing in: kept for the client shell to resume (app/(particulier)/_layout.tsx). */
export async function getPendingPresenceCode(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEYS.pendingPresenceCode);
  } catch {
    return null;
  }
}

export async function setPendingPresenceCode(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.pendingPresenceCode, code);
  } catch {
    // Not kept: the client scans the code again after signing in.
  }
}

export async function clearPendingPresenceCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.pendingPresenceCode);
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
      KEYS.pendingJoinCode,
      KEYS.pendingPresenceCode,
      KEYS.manualCity,
    ]);
  } catch {
    // ignore
  }
}
