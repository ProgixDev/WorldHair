import { Tabs } from "expo-router";
import React from "react";
import { ProTabBar } from "../../components/pro/ProTabBar";
import { ProProvider } from "../../contexts/ProContext";
import { useTheme } from "../../contexts/ThemeContext";

/** Coiffeur shell: five tabs behind the gold-accented pro bar. */
export default function ProLayout() {
  const { theme } = useTheme();

  return (
    <ProProvider>
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
    </ProProvider>
  );
}
