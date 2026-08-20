import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  View,
  ViewStyle,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useResponsive } from "../../constants/responsive";
import { spacing } from "../../constants/spacing";

interface ScreenProps {
  children: React.ReactNode;
  /** Scrolling body — use for anything with form fields. */
  scroll?: boolean;
  /** Apply the responsive horizontal gutter (off for full-bleed art). */
  padded?: boolean;
  /** Pinned to the bottom, outside the scroll area (primary CTA lives here). */
  footer?: React.ReactNode;
  /** Cap the body at a readable column and centre it (forms, tablets). */
  centered?: boolean;
  background?: string;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Page shell: background, gutters, keyboard avoidance and the sticky footer.
 * Safe-area insets are owned by the root layout, so screens never re-apply
 * them (double padding is the classic symptom when they do).
 */
export function Screen({
  children,
  scroll = false,
  padded = true,
  footer,
  centered = false,
  background,
  contentStyle,
}: ScreenProps) {
  const { theme } = useTheme();
  const { gutter, contentWidth } = useResponsive();
  const backgroundColor = background ?? theme.background.dark;

  const columnStyle: StyleProp<ViewStyle> = centered
    ? { width: "100%", maxWidth: contentWidth, alignSelf: "center", flex: 1 }
    : { width: "100%", flex: 1 };

  const padding = padded ? gutter : 0;

  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        {
          flexGrow: 1,
          paddingHorizontal: padding,
          paddingBottom: spacing.xl,
        },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      <View style={columnStyle}>{children}</View>
    </ScrollView>
  ) : (
    <View
      style={[{ flex: 1, paddingHorizontal: padding }, contentStyle]}
      collapsable={false}
    >
      <View style={columnStyle}>{children}</View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {body}
      {footer ? (
        <View
          style={{
            paddingHorizontal: padded ? gutter : 0,
            paddingTop: spacing.md,
            paddingBottom: spacing.md,
          }}
        >
          <View
            style={
              centered
                ? { width: "100%", maxWidth: contentWidth, alignSelf: "center" }
                : undefined
            }
          >
            {footer}
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
