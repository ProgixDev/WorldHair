---
name: Google (Material 3)
colors:
  background: "#f7f9fc"
  foreground: "#0c1b2e"
  brand: "#0c2340"      # Primary
  muted: "#5b7186"      # Outline/Muted
  border: "#dbe3ee"     # Outline — hairline, never a mid-grey stroke
  card: "#ffffff"       # Surface Variant
  accent: "#38b6ff"     # Secondary — actions only
  warm: "#a8703c"       # Editorial accent (ratings, rules, overlines)
  success: "#1f9d55"
  danger: "#b3261e"     # Error

  surface:              # Elevation ramp, light
    sunken: "#eef2f8"
    base: "#ffffff"
    raised: "#ffffff"
    glass: "#ffffffe6"

  dark:
    background: "#080f1a"
    foreground: "#f2f6fb"
    muted: "#93a6bc"
    border: "#1e2e45"
    card: "#111c2e"
    accent: "#38b6ff"
    warm: "#e4b980"
    success: "#4ac97e"
    danger: "#ff7a70"
    surface:            # Elevation ramp, dark — lighter = closer to the user
      sunken: "#050a12"
      base: "#111c2e"
      raised: "#17243a"
      glass: "#0c1524e6"

typography:
  fontFamily:
    sans: "Roboto, system-ui, -apple-system, sans-serif"
    mono: "Roboto Mono, monospace"
  body:
    fontSize: "16px"
    lineHeight: "1.5"
    fontWeight: "400"
  heading:
    fontWeight: "500"
    letterSpacing: "0"

rounded:
  default: "12px" # M3 uses 12px for cards/buttons by default
  md: "12px"
  lg: "18px"
  xl: "26px"
  full: "9999px"
---

<!--
WorldHair applied rules (mobile):
- Blue accent = actions only (buttons, active states, links). Never decoration.
- Warm gold = editorial signals (ratings, overlines, rules, prices from).
- Depth comes from the surface ramp + soft shadows, not from outlines. A border
  is a hairline separator, never a container's main definition.
-->


# Design System: Google (Material 3)

## Overview
Material 3 (Material You) is Google’s latest evolution of its design language. It is defined by personalization, accessibility, and an adaptive color system that responds to the user's environment.

## Design Philosophy
1. **Material You:** The brand is the user. The system uses dynamic color extraction to create a unique tonal palette based on the user's wallpaper.
2. **Adaptive Accessibility:** Uses a tonal palette system (0–100) to guarantee contrast ratios across any color combination.
3. **Personal & Expressive:** Moves away from the rigid grid of Material 2 toward softer shapes, larger interactive targets, and playful motion.
4. **Coherent Hierarchy:** Uses three tiers of tokens (Reference, System, Component) to manage complexity across platforms.

## Colors
- **The Tonal System:** Colors are defined by their luminance rather than just hue. Primary, Secondary, and Tertiary roles each have their own tonal range.
- **Surface Variant:** Used for secondary containers and cards to create subtle depth without relying on heavy shadows.
- **On-Colors:** A strict system where every background color has a corresponding "On" color (e.g., `On Primary`) for high-contrast text and icons.

## Typography
- **Roboto & Roboto Flex:** The primary font family, engineered for maximum legibility and flexibility in both digital and print.
- **Variable Weights:** Uses variable font technology to subtly shift weights based on the user's device or environment.

## Components
- **FAB (Floating Action Button):** Now often larger and square-rounded (`16px`) rather than a perfect circle.
- **Navigation Bar:** A horizontal bottom bar with large, rounded pill-shaped indicators for the active state.
- **Cards:** Feature a standard `12px` rounding and often use the "Surface Variant" color instead of a border.

## Visual Effects
- **Dynamic Color:** The primary visual flourish. The entire UI shifts its hue to match the user's context.
- **Soft Shadows:** Uses very subtle, multi-layered shadows that feel more like "ambient occlusion" than traditional drop shadows.
- **State Layers:** Interactive elements use an overlay (usually `8%` to `12%` opacity) to indicate hover and focus states.
