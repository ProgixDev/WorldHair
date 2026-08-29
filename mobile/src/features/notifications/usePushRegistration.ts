import * as Notifications from "expo-notifications";
import { useCallback, useEffect } from "react";
import { Platform } from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { notificationsApi } from "./notificationsApi";

/**
 * Requests permission if not yet determined, then registers the resulting
 * Expo push token — best-effort, never throws. Same approach as the
 * WhaleTime project (D:\Others\WhaleTime): `getExpoPushTokenAsync()` needs
 * a resolvable EAS project id to work in a real build — until `app.json`
 * has one (`eas init`, or set `extra.eas.projectId` by hand), this quietly
 * no-ops instead of crashing.
 */
export function usePushRegistration() {
  const registerIfPermitted = useCallback(async (): Promise<void> => {
    try {
      const { status: current } = await Notifications.getPermissionsAsync();
      let status = current;
      if (status === "undetermined") {
        ({ status } = await Notifications.requestPermissionsAsync());
      }
      if (status !== "granted") return;

      const { data: token } = await Notifications.getExpoPushTokenAsync();
      await notificationsApi.register({
        token,
        platform: Platform.OS === "ios" ? "ios" : "android",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    } catch {
      // Best-effort — see the doc comment above.
    }
  }, []);

  return { registerIfPermitted };
}

/** Re-runs on every app launch while signed in — a fresh install or a re-login always needs the current token registered, not just once during onboarding. */
export function usePushTokenSync(): void {
  const { session } = useAuth();
  const { registerIfPermitted } = usePushRegistration();
  const isAuthenticated = Boolean(session);

  useEffect(() => {
    if (isAuthenticated) void registerIfPermitted();
  }, [isAuthenticated, registerIfPermitted]);
}
