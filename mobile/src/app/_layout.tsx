import { Stack, usePathname } from "expo-router";
import * as NativeSplash from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View } from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext";

NativeSplash.preventAutoHideAsync();
NativeSplash.setOptions({ duration: 700, fade: true });

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <SafeAreaProvider>
          <RootLayoutWithTheme />
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutWithTheme() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  useEffect(() => {
    NativeSplash.hideAsync();
  }, []);

  // Splash screen lives at the root index — exclude it from safe area
  const isSplash = pathname === "/";

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.background.darker,
        paddingBottom: isSplash ? 0 : insets.bottom,
      }}
    >
      <SafeAreaView
        edges={isSplash ? [] : ["top"]}
        style={{ flex: 1, backgroundColor: theme.background.dark }}
      >
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.background.dark },
            animation: "fade_from_bottom",
          }}
        >
          <Stack.Screen name="index" options={{ animation: "fade" }} />
          <Stack.Screen name="home/index" options={{ animation: "fade" }} />
        </Stack>
      </SafeAreaView>
    </View>
  );
}
