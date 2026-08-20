import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { elevation } from "../../constants/elevation";
import { MIN_TOUCH_SIZE, radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

export type ButtonVariant = "primary" | "outline" | "ghost";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  /** Override the fill — onboarding slides carry their own palette. */
  background?: string;
  /** Override the label/icon color. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Pill button with an M3 state layer (a translucent overlay on press rather
 * than an opacity fade, so the label never dims).
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading = false,
  disabled = false,
  background,
  color,
  style,
}: ButtonProps) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;

  const fill =
    variant === "primary" ? (background ?? theme.primary.main) : "transparent";
  const labelColor =
    color ??
    (variant === "primary"
      ? theme.primary.on
      : variant === "outline"
        ? theme.foreground.white
        : theme.primary.main);
  const borderColor =
    variant === "outline" ? (background ?? theme.border) : "transparent";

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          minHeight: MIN_TOUCH_SIZE + 8,
          borderRadius: radius.full,
          backgroundColor: fill,
          borderWidth: variant === "outline" ? 1.5 : 0,
          borderColor,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          alignItems: "center",
          justifyContent: "center",
          opacity: isDisabled ? 0.4 : 1,
          overflow: "hidden",
          transform: [{ scale: pressed && !isDisabled ? 0.985 : 1 }],
        },
        // A filled CTA lifts off the page; ghost and outline stay flat.
        variant === "primary" && !isDisabled
          ? elevation(2, background ?? theme.primary.main)
          : null,
        style,
      ]}
    >
      {({ pressed }) => (
        <>
          {/* M3 state layer: 12% of the label color on press. */}
          {pressed && !isDisabled ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: labelColor,
                opacity: 0.12,
              }}
            />
          ) : null}
          {loading ? (
            <ActivityIndicator color={labelColor} />
          ) : (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              {icon ? (
                <MaterialCommunityIcons
                  name={icon}
                  size={20}
                  color={labelColor}
                />
              ) : null}
              <Text
                style={[
                  typography.button,
                  { color: labelColor, textAlign: "center" },
                ]}
              >
                {label}
              </Text>
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}
