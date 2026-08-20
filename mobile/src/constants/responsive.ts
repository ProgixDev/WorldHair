import { useWindowDimensions } from "react-native";

/** Clamp `value` into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export type SizeClass = "compact" | "regular" | "expanded";

/** Width buckets: small phone / normal phone / tablet-ish. */
export function sizeClassForWidth(width: number): SizeClass {
  if (width < 360) return "compact";
  if (width < 700) return "regular";
  return "expanded";
}

/** Horizontal page gutter — grows with the viewport but never runs away. */
export function gutterForWidth(width: number): number {
  return clamp(Math.round(width * 0.06), 16, 40);
}

/**
 * Content column cap so forms don't stretch edge to edge on a tablet.
 * Pure so it can be reasoned about (and later tested) without a renderer.
 */
export function contentWidthForWidth(width: number): number {
  const gutter = gutterForWidth(width);
  return Math.min(width - gutter * 2, 520);
}

/**
 * Height of the onboarding artwork band. Tall screens give the art more room;
 * short screens keep enough space for the copy block underneath.
 */
export function onboardingArtHeightForSize(
  width: number,
  height: number,
): number {
  const byHeight = height * (height < 700 ? 0.44 : 0.52);
  const byWidth = width * 1.15;
  return Math.round(clamp(Math.min(byHeight, byWidth), 260, 560));
}

/** Vertical rhythm multiplier — compact screens tighten, tablets loosen. */
export function densityForSize(width: number, height: number): number {
  if (height < 700 || width < 360) return 0.8;
  if (width >= 700) return 1.25;
  return 1;
}

/**
 * Live viewport metrics. Read through `useWindowDimensions` so rotation, fold
 * and split-view all re-render (never a module-load constant).
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const sizeClass = sizeClassForWidth(width);
  const density = densityForSize(width, height);

  return {
    width,
    height,
    sizeClass,
    isCompact: sizeClass === "compact",
    isExpanded: sizeClass === "expanded",
    gutter: gutterForWidth(width),
    contentWidth: contentWidthForWidth(width),
    onboardingArtHeight: onboardingArtHeightForSize(width, height),
    density,
    /** Scale a spacing value by the screen's density, rounded to whole px. */
    space: (base: number) => Math.round(base * density),
  };
}

export type Responsive = ReturnType<typeof useResponsive>;
