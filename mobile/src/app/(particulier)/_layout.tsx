import { Tabs } from "expo-router";
import React from "react";
import { FloatingTabBar } from "../../components/particulier/FloatingTabBar";
import { useTheme } from "../../contexts/ThemeContext";

/** Particulier shell: four tabs behind a floating pill bar. */
export default function ParticulierLayout() {
  const { theme } = useTheme();

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
