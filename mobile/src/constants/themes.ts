export interface Theme {
  primary: {
    main: string;
    light: string;
    dark: string;
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
  logo: any; // Image require() source
}

export interface ThemeVariant {
  id: string;
  name: string;
  light: Theme;
  dark: Theme;
}

// Default Theme Variant
const defaultVariant: ThemeVariant = {
  id: "default",
  name: "Default",
  dark: {
    primary: {
      main: "#C8F14A",
      light: "#D6F45F",
      dark: "#A4E600",
    },
    background: {
      dark: "#0B0D0E",
      darker: "#121417",
      accent: "#1B1F24",
    },
    foreground: {
      white: "#FFFFFF",
      gray: "#BFC3C7",
    },
    logo: require("../../assets/images/Logo.png"),
  },
  light: {
    primary: {
      main: "#A4E600",
      light: "#C8F14A",
      dark: "#8ACC00",
    },
    background: {
      dark: "#FFFFFF",
      darker: "#F5F5F5",
      accent: "#E8E8E8",
    },
    foreground: {
      white: "#0B0D0E",
      gray: "#5A5F66",
    },
    logo: require("../../assets/images/Logo.png"),
  },
};

// Nord Theme Variant
const nordVariant: ThemeVariant = {
  id: "nord",
  name: "Nord",
  dark: {
    primary: {
      main: "#88C0D0",
      light: "#8FBCBB",
      dark: "#5E81AC",
    },
    background: {
      dark: "#2E3440",
      darker: "#3B4252",
      accent: "#434C5E",
    },
    foreground: {
      white: "#ECEFF4",
      gray: "#D8DEE9",
    },
    logo: require("../../assets/images/Logo.png"),
  },
  light: {
    primary: {
      main: "#5E81AC",
      light: "#81A1C1",
      dark: "#4C6A94",
    },
    background: {
      dark: "#ECEFF4",
      darker: "#E5E9F0",
      accent: "#D8DEE9",
    },
    foreground: {
      white: "#2E3440",
      gray: "#4C566A",
    },
    logo: require("../../assets/images/Logo.png"),
  },
};

// Sapphire Theme Variant
const sapphireVariant: ThemeVariant = {
  id: "sapphire",
  name: "Sapphire",
  dark: {
    primary: {
      main: "#7AA2F7",
      light: "#9EBBFF",
      dark: "#5A8AE5",
    },
    background: {
      dark: "#1A1B26",
      darker: "#16161E",
      accent: "#24283B",
    },
    foreground: {
      white: "#C0CAF5",
      gray: "#A9B1D6",
    },
    logo: require("../../assets/images/Logo.png"),
  },
  light: {
    primary: {
      main: "#2E7DE9",
      light: "#5A9BF7",
      dark: "#2563D1",
    },
    background: {
      dark: "#D5D6DB",
      darker: "#E1E2E7",
      accent: "#C4C8DA",
    },
    foreground: {
      white: "#3760BF",
      gray: "#565A6E",
    },
    logo: require("../../assets/images/Logo.png"),
  },
};

// Strawberry Daiquiri Theme Variant
const strawberryVariant: ThemeVariant = {
  id: "strawberry",
  name: "Strawberry Daiquiri",
  dark: {
    primary: {
      main: "#FF6B9D",
      light: "#FF8FB8",
      dark: "#E05482",
    },
    background: {
      dark: "#1C1825",
      darker: "#231D2F",
      accent: "#2D2639",
    },
    foreground: {
      white: "#E0DEF4",
      gray: "#C4B5FD",
    },
    logo: require("../../assets/images/Logo.png"),
  },
  light: {
    primary: {
      main: "#E05482",
      light: "#FF6B9D",
      dark: "#C93F6B",
    },
    background: {
      dark: "#FAF4ED",
      darker: "#FFFAF3",
      accent: "#F2E9DE",
    },
    foreground: {
      white: "#575279",
      gray: "#797593",
    },
    logo: require("../../assets/images/Logo.png"),
  },
};

// Ocean Theme Variant
const oceanVariant: ThemeVariant = {
  id: "ocean",
  name: "Ocean",
  dark: {
    primary: {
      main: "#56C6E8",
      light: "#7DD6F3",
      dark: "#3BA5C7",
    },
    background: {
      dark: "#0A1F2E",
      darker: "#0D1B2A",
      accent: "#1B2B3A",
    },
    foreground: {
      white: "#E8F4F8",
      gray: "#B8D4E0",
    },
    logo: require("../../assets/images/Logo.png"),
  },
  light: {
    primary: {
      main: "#0891B2",
      light: "#22D3EE",
      dark: "#0E7490",
    },
    background: {
      dark: "#F0F9FF",
      darker: "#E0F2FE",
      accent: "#BAE6FD",
    },
    foreground: {
      white: "#164E63",
      gray: "#0E7490",
    },
    logo: require("../../assets/images/Logo.png"),
  },
};

// Amber Theme Variant
const amberVariant: ThemeVariant = {
  id: "amber",
  name: "Amber",
  dark: {
    primary: {
      main: "#FDB813",
      light: "#FDCB3D",
      dark: "#E59F00",
    },
    background: {
      dark: "#1C1917",
      darker: "#292524",
      accent: "#44403C",
    },
    foreground: {
      white: "#FAFAF9",
      gray: "#D6D3D1",
    },
    logo: require("../../assets/images/Logo.png"),
  },
  light: {
    primary: {
      main: "#F59E0B",
      light: "#FDB813",
      dark: "#D97706",
    },
    background: {
      dark: "#FFFBEB",
      darker: "#FEF3C7",
      accent: "#FDE68A",
    },
    foreground: {
      white: "#78350F",
      gray: "#92400E",
    },
    logo: require("../../assets/images/Logo.png"),
  },
};

export const themeVariants: ThemeVariant[] = [
  defaultVariant,
  nordVariant,
  sapphireVariant,
  strawberryVariant,
  oceanVariant,
  amberVariant,
];

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
