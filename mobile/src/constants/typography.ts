import { TextStyle } from "react-native";

/**
 * Font family keys as registered with `useFonts` in app/_layout.tsx.
 * Playfair Display carries the editorial headings, Roboto everything else
 * (DESIGN.md: Roboto is the system face).
 */
export const fontFamily = {
  displayRegular: "PlayfairDisplay-Regular",
  displayMedium: "PlayfairDisplay-Medium",
  displayBold: "PlayfairDisplay-Bold",
  sansRegular: "Roboto-Regular",
  sansMedium: "Roboto-Medium",
  sansBold: "Roboto-Bold",
} as const;

/**
 * Type presets. `fontSize` is never scaled by hand — the OS already applies the
 * user's font-size setting, so containers must flex around the text instead
 * (see .agents/AGENTS.md).
 */
export const typography = {
  /** Onboarding / auth hero heading. */
  display: {
    fontFamily: fontFamily.displayBold,
    fontSize: 34,
    lineHeight: 41,
    letterSpacing: -0.4,
  },
  /** Screen title. */
  h1: {
    fontFamily: fontFamily.displayBold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.2,
  },
  /** Section title. */
  h2: {
    fontFamily: fontFamily.displayMedium,
    fontSize: 20,
    lineHeight: 26,
  },
  /** Wordmark. */
  wordmark: {
    fontFamily: fontFamily.displayMedium,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 0.4,
  },
  body: {
    fontFamily: fontFamily.sansRegular,
    fontSize: 16,
    lineHeight: 24,
  },
  bodyMedium: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 16,
    lineHeight: 24,
  },
  bodySmall: {
    fontFamily: fontFamily.sansRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 14,
    lineHeight: 18,
  },
  button: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  caption: {
    fontFamily: fontFamily.sansRegular,
    fontSize: 12,
    lineHeight: 16,
  },
  /** All-caps eyebrow / kicker. */
  overline: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2,
  },
} satisfies Record<string, TextStyle>;

export type TypographyPreset = keyof typeof typography;
