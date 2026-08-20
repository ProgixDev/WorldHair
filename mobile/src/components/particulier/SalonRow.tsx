import { Image } from "expo-image";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import { accentFor, coverFor } from "../../features/salons/covers";
import { formatDistance } from "../../features/salons/geo";
import type { SalonWithDistance } from "../../features/salons/types";
import { formatPrice } from "../../utils/date";
import { RatingStars } from "../ui/RatingStars";

interface SalonRowProps {
  salon: SalonWithDistance;
  onPress: () => void;
}

/**
 * Search-result row: a distance rail on the left, portrait thumbnail, then the
 * copy. Reads as an index — nothing like the map carousel's landscape card.
 */
export function SalonRow({ salon, onPress }: SalonRowProps) {
  const { theme } = useTheme();
  const accent = accentFor(salon.id);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={salon.name + ", " + salon.tagline}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "stretch",
        gap: spacing.md,
        paddingVertical: spacing.md,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {/* Distance rail */}
      <View style={{ width: 46, alignItems: "center", gap: spacing.xs }}>
        <Text
          style={[typography.label, { color: accent, textAlign: "center" }]}
          numberOfLines={1}
        >
          {formatDistance(salon.distanceKm)}
        </Text>
        <View
          style={{
            flex: 1,
            width: 2,
            borderRadius: radius.full,
            backgroundColor: theme.border,
          }}
        />
      </View>

      <Image
        source={coverFor(salon)}
        style={{
          width: 64,
          height: 84,
          borderRadius: radius.md,
          backgroundColor: theme.background.accent,
        }}
        contentFit="cover"
        transition={150}
      />

      <View style={{ flex: 1, gap: spacing.xs, paddingRight: spacing.xs }}>
        <Text
          style={[typography.bodyMedium, { color: theme.foreground.white }]}
          numberOfLines={1}
        >
          {salon.name}
        </Text>
        <Text
          style={[typography.caption, { color: theme.foreground.gray }]}
          numberOfLines={2}
        >
          {salon.tagline}
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.sm,
          }}
        >
          <RatingStars value={salon.rating} size={12} showValue />
          <Text style={[typography.caption, { color: theme.foreground.gray }]}>
            {"(" + salon.reviewCount + ")"}
          </Text>
          <View style={{ flex: 1 }} />
          <Text style={[typography.label, { color: theme.primary.main }]}>
            {"dès " + formatPrice(salon.priceFrom)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
