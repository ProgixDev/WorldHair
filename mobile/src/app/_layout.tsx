import { useFonts } from "expo-font";
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
import { AuthProvider } from "../contexts/AuthContext";
import { LocationProvider } from "../contexts/LocationContext";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext";

NativeSplash.preventAutoHideAsync();
NativeSplash.setOptions({ duration: 700, fade: true });

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <LocationProvider>
            <SafeAreaProvider>
              <RootLayoutWithTheme />
            </SafeAreaProvider>
          </LocationProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Routes that paint edge to edge and own their insets: the splash, the
 * onboarding art, and the whole particulier area (floating tab bar, full-bleed
 * map, parallax salon page, docked booking bar).
 */
const IMMERSIVE_PREFIXES = [
  "/onboarding",
  "/discover",
  "/search",
  "/appointments",
  "/profile",
  "/salon",
  "/booking",
  "/review",
];

function isImmersiveRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    IMMERSIVE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function RootLayoutWithTheme() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const [fontsLoaded] = useFonts({
    "PlayfairDisplay-Regular": require("../../assets/fonts/PlayfairDisplay/PlayfairDisplay-Regular.ttf"),
    "PlayfairDisplay-Medium": require("../../assets/fonts/PlayfairDisplay/PlayfairDisplay-Medium.ttf"),
    "PlayfairDisplay-Bold": require("../../assets/fonts/PlayfairDisplay/PlayfairDisplay-Bold.ttf"),
    "Roboto-Regular": require("../../assets/fonts/Roboto/Roboto-Regular.ttf"),
    "Roboto-Medium": require("../../assets/fonts/Roboto/Roboto-Medium.ttf"),
    "Roboto-Bold": require("../../assets/fonts/Roboto/Roboto-Bold.ttf"),
  });

  // Hold the native splash until the faces resolve, so no heading swaps
  // typeface mid-view.
  useEffect(() => {
    if (fontsLoaded) NativeSplash.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  const immersive = isImmersiveRoute(pathname);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.background.darker,
        paddingBottom: immersive ? 0 : insets.bottom,
      }}
    >
      <SafeAreaView
        edges={immersive ? [] : ["top"]}
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
          <Stack.Screen
            name="onboarding/index"
            options={{ animation: "fade" }}
          />
          <Stack.Screen name="(particulier)" options={{ animation: "fade" }} />
          <Stack.Screen
            name="salon/[id]"
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="booking/[salonId]"
            options={{ animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="review/[appointmentId]"
            options={{ animation: "slide_from_bottom" }}
          />
        </Stack>
      </SafeAreaView>
    </View>
  );
}
