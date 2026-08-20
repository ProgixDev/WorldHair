import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { elevation } from "../../constants/elevation";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import { coverFor, coverPlaceholder } from "../../features/salons/images";
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
      style={({ pressed }) => [
        {
          width,
          flexDirection: "row",
          gap: spacing.lg,
          padding: spacing.md,
          borderRadius: radius.xl,
          backgroundColor: theme.surface.raised,
          borderWidth: 1.5,
          borderColor: active ? theme.primary.main : theme.divider,
          opacity: pressed ? 0.9 : 1,
        },
        elevation(active ? 3 : 2, theme.shadow),
      ]}
    >
      <Image
        source={coverFor(salon, 400)}
        placeholder={coverPlaceholder(salon.id)}
        placeholderContentFit="cover"
        cachePolicy="memory-disk"
        style={{
          width: 104,
          height: 104,
          borderRadius: radius.lg,
          backgroundColor: theme.surface.sunken,
        }}
        contentFit="cover"
        transition={200}
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
            {salon.badges.length > 0
              ? salon.badges[0]
              : salon.specialties.map(specialtyLabel).slice(0, 2).join(" · ")}
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

        <View
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: spacing.md,
            paddingVertical: 3,
            borderRadius: radius.full,
            backgroundColor: theme.accent.warmSoft,
          }}
        >
          <Text style={[typography.label, { color: theme.accent.warm }]}>
            {"dès " + formatPrice(salon.priceFrom)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
