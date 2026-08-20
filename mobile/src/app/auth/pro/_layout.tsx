import { Stack } from "expo-router";
import React from "react";
import { useTheme } from "../../../contexts/ThemeContext";
import { ProApplicationProvider } from "../../../features/pro/ProApplicationContext";

/** The coiffeur wizard shares one draft across its three steps. */
export default function ProLayout() {
  const { theme } = useTheme();

  return (
    <ProApplicationProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background.dark },
          animation: "slide_from_right",
        }}
      />
    </ProApplicationProvider>
  );
}
