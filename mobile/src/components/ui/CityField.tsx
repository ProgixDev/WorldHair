import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleProp, Text, View, ViewStyle } from "react-native";
import { CityPicker } from "./CityPicker";
import { MIN_TOUCH_SIZE, radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";

interface CityFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  /** The picked city's coordinates — pro/salon.tsx uses this to geocode the salon for the particulier map/radius search. */
  onPickCoords?: (coords: { latitude: number; longitude: number }) => void;
  placeholder?: string;
  error?: string;
  helper?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Same TextField shell, but tapping it opens the shared CityPicker (search,
 * worldwide, via Mapbox) instead of a keyboard — the same picking experience
 * as onboarding's/`/discover`'s "Choisir une ville", reused here for a
 * salon's own address city rather than a particulier's fallback location.
 */
export function CityField({
  label,
  value,
  onChangeText,
  onPickCoords,
  placeholder = "Choisir une ville",
  error,
  helper,
  style,
}: CityFieldProps) {
  const { theme } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  const borderColor = error ? theme.danger : theme.border;

  return (
    <View style={[{ gap: spacing.xs }, style]}>
      <Text style={[typography.label, { color: theme.foreground.gray }]}>
        {label}
      </Text>

      <Pressable
        onPress={() => setPickerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label + (value ? " : " + value : "")}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          minHeight: MIN_TOUCH_SIZE + 8,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor,
          backgroundColor: theme.surface.base,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <MaterialCommunityIcons
          name="city-variant-outline"
          size={20}
          color={theme.foreground.gray}
        />
        <Text
          style={[
            typography.body,
            { flex: 1, color: value ? theme.foreground.white : theme.foreground.gray },
          ]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <MaterialCommunityIcons
          name="chevron-down"
          size={16}
          color={theme.foreground.gray}
        />
      </Pressable>

      {error ? (
        <Text style={[typography.caption, { color: theme.danger }]}>
          {error}
        </Text>
      ) : helper ? (
        <Text style={[typography.caption, { color: theme.foreground.gray }]}>
          {helper}
        </Text>
      ) : null}

      <CityPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(city) => {
          onChangeText(city.label);
          onPickCoords?.({ latitude: city.latitude, longitude: city.longitude });
          setPickerOpen(false);
        }}
      />
    </View>
  );
}
