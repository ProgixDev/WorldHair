import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";

interface RatingStarsProps {
  value: number;
  size?: number;
  /** Makes the row interactive (review screen). */
  onChange?: (value: number) => void;
  /** Trailing "4,9" label. */
  showValue?: boolean;
  color?: string;
}

/** Five stars, half-filled when the average lands mid-way. */
export function RatingStars({
  value,
  size = 16,
  onChange,
  showValue = false,
  color,
}: RatingStarsProps) {
  const { theme } = useTheme();
  const tint = color ?? theme.accent.warm;

  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
      accessibilityRole={onChange ? "adjustable" : "image"}
      accessibilityLabel={
        "Note " + value.toFixed(1).replace(".", ",") + " sur 5"
      }
    >
      <View style={{ flexDirection: "row", gap: onChange ? spacing.sm : 2 }}>
        {[1, 2, 3, 4, 5].map((star) => {
          const name =
            value >= star
              ? "star"
              : value >= star - 0.5
                ? "star-half-full"
                : "star-outline";

          const icon = (
            <MaterialCommunityIcons
              name={name}
              size={size}
              color={value >= star - 0.5 ? tint : theme.foreground.gray}
            />
          );

          if (!onChange) return <View key={star}>{icon}</View>;

          return (
            <Pressable
              key={star}
              onPress={() => onChange(star)}
              accessibilityRole="button"
              accessibilityLabel={star + " étoile" + (star > 1 ? "s" : "")}
              hitSlop={6}
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.9 : 1 }],
              })}
            >
              {icon}
            </Pressable>
          );
        })}
      </View>

      {showValue ? (
        <Text style={[typography.label, { color: theme.foreground.white }]}>
          {value.toFixed(1).replace(".", ",")}
        </Text>
      ) : null}
    </View>
  );
}
