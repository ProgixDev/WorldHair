import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Right-hand count, e.g. active filters. */
  badge?: number;
  /** Reads as a static tag rather than a control. */
  readOnly?: boolean;
  /**
   * Selected fill + border color — defaults to the app's blue. Pro screens
   * pass `theme.accent.warm` so chips match their gold accent instead.
   */
  accentColor?: string;
  /** Label/icon color on top of `accentColor` when selected. */
  accentOnColor?: string;
}

/** Compact pill used for specialties, filters and tags. */
export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  badge,
  readOnly = false,
  accentColor,
  accentOnColor,
}: ChipProps) {
  const { theme } = useTheme();
  const accent = accentColor ?? theme.primary.main;
  const accentOn = accentOnColor ?? theme.primary.on;

  const content = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        minHeight: 42,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: selected ? accent : theme.border,
        backgroundColor: selected ? accent : theme.surface.base,
      }}
    >
      {icon ? (
        <MaterialCommunityIcons
          name={icon}
          size={17}
          color={selected ? accentOn : theme.accent.warm}
        />
      ) : null}
      <Text
        style={[
          typography.label,
          { color: selected ? accentOn : theme.foreground.white },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {badge !== undefined && badge > 0 ? (
        <View
          style={{
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: radius.full,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: selected ? accentOn : accent,
          }}
        >
          <Text
            style={[
              typography.caption,
              {
                color: selected ? accent : accentOn,
                fontSize: 11,
              },
            ]}
          >
            {badge}
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (readOnly || !onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {content}
    </Pressable>
  );
}
