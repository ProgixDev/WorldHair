import { Tabs } from "expo-router";
import React from "react";
import { View } from "react-native";
import { ProTabBar } from "../../components/pro/ProTabBar";
import { SubscriptionExpiredOverlay } from "../../components/pro/SubscriptionExpiredOverlay";
import { ProProvider, usePro } from "../../contexts/ProContext";
import { useTheme } from "../../contexts/ThemeContext";
import { isSubscriptionExpired } from "../../features/pro/subscription";

/** Coiffeur shell: five tabs behind the gold-accented pro bar. */
export default function ProLayout() {
  return (
    <ProProvider>
      <ProGate />
    </ProProvider>
  );
}

/**
 * Blocks the whole pro area once the subscription has actually lapsed
 * (issue #8) — a translucent overlay on top of the tabs, not a route swap,
 * so nothing underneath needs to know about it.
 */
function ProGate() {
  const { theme } = useTheme();
  const { subscription, isLoading } = usePro();
  const expired = !isLoading && subscription
    ? isSubscriptionExpired(subscription)
    : false;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <ProTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: theme.background.dark },
        }}
      >
        <Tabs.Screen name="dashboard" options={{ title: "Tableau de bord" }} />
        <Tabs.Screen name="agenda" options={{ title: "Agenda" }} />
        <Tabs.Screen name="salon" options={{ title: "Mon salon" }} />
        <Tabs.Screen name="reviews" options={{ title: "Avis" }} />
        <Tabs.Screen name="account" options={{ title: "Compte" }} />
      </Tabs>
      {expired ? <SubscriptionExpiredOverlay /> : null}
    </View>
  );
}
