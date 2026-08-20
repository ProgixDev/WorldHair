import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import { coverFor } from "../../features/salons/covers";
import { formatDistance } from "../../features/salons/geo";
import { specialtyLabel } from "../../features/salons/types";
import type { SalonWithDistance } from "../../features/salons/types";
import { formatPrice } from "../../utils/date";
import { RatingStars } from "../ui/RatingStars";

interface SalonCardProps {
  salon: SalonWithDistance;
  width: number;
  onPress: () => void;
  /** Highlighted because its map pin is selected. */
  active?: boolean;
}

/**
 * Wide landscape card for the map carousel: cover on the left, the essentials
 * stacked on the right. Deliberately different from the search list row.
 */
export function SalonCard({ salon, width, onPress, active }: SalonCardProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={salon.name + ", " + formatDistance(salon.distanceKm)}
      style={({ pressed }) => ({
        width,
        flexDirection: "row",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: theme.background.accent,
        borderWidth: 1,
        borderColor: active ? theme.primary.main : theme.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Image
        source={coverFor(salon)}
        style={{
          width: 92,
          height: 92,
          borderRadius: radius.lg,
          backgroundColor: theme.background.darker,
        }}
        contentFit="cover"
        transition={150}
      />

      <View
        style={{ flex: 1, justifyContent: "space-between", gap: spacing.xs }}
      >
        <View style={{ gap: 2 }}>
          <Text
            style={[typography.bodyMedium, { color: theme.foreground.white }]}
            numberOfLines={1}
          >
            {salon.name}
          </Text>
          <Text
            style={[typography.caption, { color: theme.foreground.gray }]}
            numberOfLines={1}
          >
            {salon.specialties.map(specialtyLabel).slice(0, 2).join(" · ")}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            flexWrap: "wrap",
          }}
        >
          <RatingStars value={salon.rating} size={13} showValue />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
            }}
          >
            <MaterialCommunityIcons
              name="map-marker-outline"
              size={13}
              color={theme.foreground.gray}
            />
            <Text
              style={[typography.caption, { color: theme.foreground.gray }]}
            >
              {formatDistance(salon.distanceKm)}
            </Text>
          </View>
        </View>

        <Text style={[typography.caption, { color: theme.primary.main }]}>
          {"dès " + formatPrice(salon.priceFrom)}
        </Text>
      </View>
    </Pressable>
  );
}
