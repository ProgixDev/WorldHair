import { Platform, ViewStyle } from "react-native";

/**
 * Soft shadow presets. Depth is what keeps cards from reading as flat grey
 * rectangles; outlines alone made every surface look identical (DESIGN.md).
 */
export function elevation(
  level: 0 | 1 | 2 | 3,
  shadowColor: string,
): ViewStyle {
  if (level === 0) return {};

  const config = {
    1: { opacity: 0.1, radius: 10, offset: 3, android: 2 },
    2: { opacity: 0.16, radius: 20, offset: 8, android: 6 },
    3: { opacity: 0.24, radius: 32, offset: 14, android: 12 },
  }[level];

  return Platform.select<ViewStyle>({
    ios: {
      shadowColor,
      shadowOpacity: config.opacity,
      shadowRadius: config.radius,
      shadowOffset: { width: 0, height: config.offset },
    },
    android: { elevation: config.android, shadowColor },
    default: {},
  }) as ViewStyle;
}

/** Height reserved for the floating tab bar, before safe-area insets. */
export const TAB_BAR_HEIGHT = 74;

/** Bottom padding a particulier screen needs so content clears the tab bar. */
export const TAB_BAR_CLEARANCE = TAB_BAR_HEIGHT + 24;
