import { Stack } from "expo-router";
import React from "react";
import { useTheme } from "../../contexts/ThemeContext";

/**
 * A salon's staff member (TODO.md Phase 3): their own agenda, read-only,
 * and their account — no tabs, nothing of the salon's management, which
 * stays with its owner.
 */
export default function StaffLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background.dark },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Mon agenda" }} />
      <Stack.Screen name="account" options={{ title: "Compte", animation: "slide_from_right" }} />
    </Stack>
  );
}
