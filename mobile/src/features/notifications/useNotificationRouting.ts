import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useAuth } from "../../contexts/AuthContext";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Required on Android or the notification is silently dropped.
if (Platform.OS === "android") {
  void Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Foreground banner (set above) + tap-to-navigate, covering all three app
 * states (killed/background/foreground) — same approach as the WhaleTime
 * project (D:\Others\WhaleTime). Every notification this app sends is about
 * an appointment, so a tap just opens the role-appropriate agenda — there's
 * no single-appointment detail screen to deep-link into yet.
 */
export function useNotificationRouting(): void {
  const router = useRouter();
  const { session } = useAuth();
  const handledInitialResponse = useRef(false);
  const role = session?.role;

  useEffect(() => {
    const destination = role === "coiffeur" ? "/pro/agenda" : "/appointments";

    if (!handledInitialResponse.current) {
      handledInitialResponse.current = true;
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) router.push(destination as never);
      });
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      router.push(destination as never);
    });
    return () => subscription.remove();
  }, [router, role]);
}
