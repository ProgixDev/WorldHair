import type { MaterialCommunityIcons } from "@expo/vector-icons";
import type { LocationIntent } from "../../services/preferences";

export interface SlidePalette {
  /** Page surface. Sampled from the artwork so the photo dissolves into it. */
  surface: string;
  /** Headings and body on that surface. */
  onSurface: string;
  /** Secondary copy. */
  muted: string;
  /** Warm editorial rule above the heading. */
  rule: string;
}

export interface OnboardingSlideData {
  id: string;
  /** Bundled asset, a remote/admin-uploaded photo, or none yet. */
  art: number | { uri: string } | null;
  /** Shown instead of the photo panel while `art` is null. */
  iconFallback?: keyof typeof MaterialCommunityIcons.glyphMap;
  palette: SlidePalette;
  /** Art covers the whole page (slide 1) instead of a top panel. */
  fullBleed: boolean;
  wordmark?: { title: string; tagline: string };
  heading: string;
  body: string;
  cta: {
    label: string;
    icon?: keyof typeof MaterialCommunityIcons.glyphMap;
    /** Set on the last slide: which way the user wants to find salons. */
    locationIntent?: LocationIntent;
  };
  secondaryCta?: { label: string; locationIntent: LocationIntent };
}

/**
 * Onboarding is a fixed-palette brand moment, not a themed screen: each slide
 * wears the colors of its own artwork (navy / cream / warm white) exactly as
 * designed. The app theme takes over from the auth screens onward. Swapping
 * to theme-driven surfaces is a change to `palette` here and nothing else.
 */
export const ONBOARDING_SLIDES: OnboardingSlideData[] = [
  {
    id: "welcome",
    art: require("../../../assets/images/OnBoarding/OnBoarding1.png"),
    palette: {
      surface: "#000f20",
      onSurface: "#f6f1ea",
      muted: "#a9bccd",
      rule: "#d8b48a",
    },
    fullBleed: true,
    wordmark: { title: "WorldHair", tagline: "LA BEAUTÉ, PARTOUT." },
    heading: "Votre prochain look commence ici.",
    body: "Les meilleurs coiffeurs, choisis pour vous.",
    cta: { label: "Commencer" },
  },
  {
    id: "style",
    art: require("../../../assets/images/OnBoarding/OnBoarding2.png"),
    palette: {
      surface: "#f2e6d9",
      onSurface: "#14202e",
      muted: "#6d6155",
      rule: "#b9855a",
    },
    fullBleed: false,
    heading: "Une coiffure qui vous ressemble.",
    body: "Explorez les styles, les talents et les idées qui vous inspirent.",
    cta: { label: "Trouver mon style" },
  },
  {
    id: "location",
    art: require("../../../assets/images/OnBoarding/OnBoarding3.png"),
    palette: {
      surface: "#f7f4f1",
      onSurface: "#0c2340",
      muted: "#5b7186",
      rule: "#b9855a",
    },
    fullBleed: false,
    heading: "Le bon salon, au bon moment.",
    body: "Réservez en quelques instants, près de chez vous.",
    cta: {
      label: "Activer ma position",
      icon: "map-marker-outline",
      locationIntent: "gps",
    },
    secondaryCta: { label: "Choisir une ville", locationIntent: "manual" },
  },
  {
    id: "products",
    // No bundled photo: the real image is uploaded by an admin (issue #5).
    // `app/onboarding/index.tsx` fetches it through `services/content.ts`
    // and swaps it in here once it resolves.
    art: null,
    iconFallback: "spray-bottle",
    palette: {
      surface: "#f7f4f1",
      onSurface: "#0c2340",
      muted: "#5b7186",
      rule: "#b9855a",
    },
    fullBleed: false,
    heading: "Des produits de qualité",
    body: "Nos coiffeurs travaillent avec des marques professionnelles, choisies pour prendre soin de chaque type de cheveux.",
    cta: { label: "Découvrir WorldHair" },
  },
];

/** CTA pill, identical on every slide (DESIGN.md accent on brand ink). */
export const SLIDE_CTA = {
  background: "#38b6ff",
  label: "#0c2340",
} as const;
