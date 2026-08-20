export interface Theme {
  primary: {
    main: string;
    light: string;
    dark: string;
    /** Readable text/icon color to place on top of `primary.main`. */
    on: string;
    /** Tinted wash for selected rows and soft badges. */
    soft: string;
  };
  background: {
    dark: string;
    darker: string;
    accent: string;
  };
  /**
   * Elevation ramp. Depth comes from these plus a soft shadow — outlines are
   * hairline separators, never a card's main definition (DESIGN.md).
   */
  surface: {
    sunken: string;
    base: string;
    raised: string;
    /** Translucent panel for overlays that sit on artwork or the map. */
    glass: string;
  };
  foreground: {
    white: string;
    gray: string;
  };
  /** Editorial warm tone borrowed from the onboarding art (rules, ratings). */
  accent: {
    warm: string;
    /** Warm wash behind gold badges. */
    warmSoft: string;
  };
  border: string;
  /** Even lighter stroke for separators inside a card. */
  divider: string;
  danger: string;
  success: string;
  /** Shadow color for the elevation presets. */
  shadow: string;
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
      on: "#04121f",
      soft: "#38b6ff1f",
    },
    background: {
      dark: "#080f1a",
      darker: "#0c1524",
      accent: "#111c2e",
    },
    surface: {
      sunken: "#050a12",
      base: "#111c2e",
      raised: "#17243a",
      glass: "#0c1524e6",
    },
    foreground: {
      white: "#f2f6fb",
      gray: "#93a6bc",
    },
    accent: {
      warm: "#e4b980",
      warmSoft: "#e4b9801f",
    },
    border: "#1e2e45",
    divider: "#16233a",
    danger: "#ff7a70",
    success: "#4ac97e",
    shadow: "#000000",
    logo: require("../../assets/images/Logo.png"),
  },
  light: {
    primary: {
      main: "#0c2340",
      light: "#38b6ff",
      dark: "#081a30",
      on: "#ffffff",
      soft: "#0c23400f",
    },
    background: {
      dark: "#f7f9fc",
      darker: "#eef2f8",
      accent: "#ffffff",
    },
    surface: {
      sunken: "#eef2f8",
      base: "#ffffff",
      raised: "#ffffff",
      glass: "#ffffffe6",
    },
    foreground: {
      white: "#0c1b2e",
      gray: "#5b7186",
    },
    accent: {
      warm: "#a8703c",
      warmSoft: "#a8703c14",
    },
    border: "#dbe3ee",
    divider: "#e8edf4",
    danger: "#b3261e",
    success: "#1f9d55",
    shadow: "#0c2340",
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
