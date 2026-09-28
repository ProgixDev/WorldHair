import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { notificationDestination } from "./destination";

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
 * project (D:\Others\WhaleTime). See destination.ts for where a tap lands.
 */
export function useNotificationRouting(): void {
  const router = useRouter();
  const { session } = useAuth();
  const handledInitialResponse = useRef(false);
  const role = session?.role;

  useEffect(() => {
    const open = (response: Notifications.NotificationResponse) =>
      router.push(
        notificationDestination(role, response.notification.request.content.data) as never,
      );

    if (!handledInitialResponse.current) {
      handledInitialResponse.current = true;
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) open(response);
      });
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [router, role]);
}
