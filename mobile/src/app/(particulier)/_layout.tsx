import { Tabs, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { FloatingTabBar } from "../../components/particulier/FloatingTabBar";
import { useTheme } from "../../contexts/ThemeContext";
import { clearPendingPresenceCode, getPendingPresenceCode } from "../../services/preferences";

/** Particulier shell: four tabs behind a floating pill bar. */
export default function ParticulierLayout() {
  const { theme } = useTheme();
  const router = useRouter();

  // A « code de fin » scanned before signing in (app/rdv/[code].tsx): the client has just landed here, so
  // pick it up. Cleared first, so nothing can loop back to it.
  useEffect(() => {
    let current = true;
    void (async () => {
      try {
        const code = await getPendingPresenceCode();
        if (!code || !current) return;
        await clearPendingPresenceCode();
        router.replace(("/rdv/" + encodeURIComponent(code)) as never);
      } catch {
        // The client scans the code again.
      }
    })();
    return () => {
      current = false;
    };
  }, [router]);

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.background.dark },
      }}
    >
      <Tabs.Screen name="discover" options={{ title: "Découvrir" }} />
      <Tabs.Screen name="search" options={{ title: "Recherche" }} />
      <Tabs.Screen name="appointments" options={{ title: "Mes RDV" }} />
      <Tabs.Screen name="profile" options={{ title: "Profil" }} />
    </Tabs>
  );
}
