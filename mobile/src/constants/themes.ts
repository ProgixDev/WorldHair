export interface Theme {
  primary: {
    main: string;
    light: string;
    dark: string;
    /** Readable text/icon color to place on top of `primary.main`. */
    on: string;
  };
  background: {
    dark: string;
    darker: string;
    accent: string;
  };
  foreground: {
    white: string;
    gray: string;
  };
  /** Editorial warm tone borrowed from the onboarding art (rules, tags). */
  accent: {
    warm: string;
  };
  border: string;
  danger: string;
  success: string;
  logo: any; // Image require() source
}

export interface ThemeVariant {
  id: string;
  name: string;
  light: Theme;
  dark: Theme;
}

// Default Theme Variant — maps DESIGN.md's brand (deep blue) / accent
// (bright blue) tokens onto primary. Deep blue leads in light mode (best
// contrast on the light bg); bright blue leads in dark mode (deep blue is
// nearly invisible against the dark bg, so the two swap which one is "main").
const defaultVariant: ThemeVariant = {
  id: "default",
  name: "WorldHair",
  dark: {
    primary: {
      main: "#38b6ff",
      light: "#7dd3ff",
      dark: "#0c2340",
      on: "#062033",
    },
    background: {
      dark: "#0a1626",
      darker: "#0f1d30",
      accent: "#122036",
    },
    foreground: {
      white: "#eaf2fa",
      gray: "#8ba3b8",
    },
    accent: {
      warm: "#d8b48a",
    },
    border: "#1c3350",
    danger: "#ff8a80",
    success: "#4ac97e",
    logo: require("../../assets/images/Logo.png"),
  },
  light: {
    primary: {
      main: "#0c2340",
      light: "#38b6ff",
      dark: "#081a30",
      on: "#ffffff",
    },
    background: {
      dark: "#f5f8fb",
      darker: "#eaf0f6",
      accent: "#ffffff",
    },
    foreground: {
      white: "#0c2340",
      gray: "#5b7186",
    },
    accent: {
      warm: "#b9855a",
    },
    border: "#8ba3b8",
    danger: "#b3261e",
    success: "#24a148",
    logo: require("../../assets/images/Logo.png"),
  },
};

export const themeVariants: ThemeVariant[] = [defaultVariant];

export type ThemeMode = "system" | "light" | "dark";

// Helper function to get theme by variant and mode
export function getThemeByVariantAndMode(
  variantId: string,
  mode: "light" | "dark",
): Theme {
  const variant =
    themeVariants.find((v) => v.id === variantId) || defaultVariant;
  return mode === "light" ? variant.light : variant.dark;
}
