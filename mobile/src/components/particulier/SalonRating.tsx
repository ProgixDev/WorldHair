import React from "react";
import { Text, View } from "react-native";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import { ratingLabel } from "../../features/salons/rating";
import { RatingStars } from "../ui/RatingStars";

interface SalonRatingProps {
  salon: { rating: number; reviewCount: number };
  size?: number;
  /** Trailing "(12)" review count. */
  showCount?: boolean;
}

/** Stars and average from the salon's real reviews, or a "Nouveau" tag before its first one. */
export function SalonRating({ salon, size = 13, showCount = false }: SalonRatingProps) {
  const { theme } = useTheme();

  if (ratingLabel(salon) === null) {
    return (
      <View
        accessibilityLabel="Nouveau salon, pas encore d'avis"
        style={{
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
          borderRadius: radius.full,
          backgroundColor: theme.primary.soft,
        }}
      >
        <Text style={[typography.caption, { color: theme.primary.main }]}>
          Nouveau
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
      <RatingStars value={salon.rating} size={size} showValue />
      {showCount ? (
        <Text style={[typography.caption, { color: theme.foreground.gray }]}>
          {"(" + salon.reviewCount + ")"}
        </Text>
      ) : null}
    </View>
  );
}
