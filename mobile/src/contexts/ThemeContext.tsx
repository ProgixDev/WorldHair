import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Appearance, ColorSchemeName } from "react-native";
import {
  Theme,
  ThemeMode,
  getThemeByVariantAndMode,
  themeVariants,
} from "../constants/themes";

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  variantId: string;
  setThemeMode: (mode: ThemeMode) => void;
  setVariantId: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_MODE_STORAGE_KEY = "@mywallet_theme_mode";
const THEME_VARIANT_STORAGE_KEY = "@mywallet_theme_variant";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [variantId, setVariantIdState] = useState<string>("default");
  const [systemColorScheme, setSystemColorScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme(),
  );

  // Listen to system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemColorScheme(colorScheme);
    });

    return () => subscription.remove();
  }, []);

  // Load theme preferences from storage on mount
  useEffect(() => {
    const loadThemePreferences = async () => {
      try {
        const [storedMode, storedVariant] = await Promise.all([
          AsyncStorage.getItem(THEME_MODE_STORAGE_KEY),
          AsyncStorage.getItem(THEME_VARIANT_STORAGE_KEY),
        ]);

        if (
          storedMode === "system" ||
          storedMode === "light" ||
          storedMode === "dark"
        ) {
          setThemeModeState(storedMode);
        }

        if (
          storedVariant &&
          themeVariants.find((v) => v.id === storedVariant)
        ) {
          setVariantIdState(storedVariant);
        }
      } catch (error) {
        console.error("Error loading theme preferences:", error);
      }
    };

    loadThemePreferences();
  }, []);

  // Save theme mode to storage when it changes
  const setThemeMode = async (newMode: ThemeMode) => {
    try {
      setThemeModeState(newMode);
      await AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, newMode);
    } catch (error) {
      console.error("Error saving theme mode:", error);
    }
  };

  // Save theme variant to storage when it changes
  const setVariantId = async (newVariantId: string) => {
    try {
      setVariantIdState(newVariantId);
      await AsyncStorage.setItem(THEME_VARIANT_STORAGE_KEY, newVariantId);
    } catch (error) {
      console.error("Error saving theme variant:", error);
    }
  };

  // Determine the actual theme to use
  const getActiveTheme = (): Theme => {
    const effectiveMode =
      themeMode === "system"
        ? systemColorScheme === "light"
          ? "light"
          : "dark"
        : themeMode;

    return getThemeByVariantAndMode(variantId, effectiveMode);
  };

  const theme = getActiveTheme();

  return (
    <ThemeContext.Provider
      value={{ theme, themeMode, variantId, setThemeMode, setVariantId }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // Return default theme if context is not available
    return {
      theme: getThemeByVariantAndMode("default", "dark"),
      themeMode: "system" as ThemeMode,
      variantId: "default",
      setThemeMode: () => {},
      setVariantId: () => {},
    };
  }
  return context;
}
