import React from "react";
import { Text, View } from "react-native";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

interface PaginationProps {
  index: number;
  total: number;
  activeColor: string;
  inactiveColor: string;
  counterColor: string;
}

/** Dots on the left, "n/3" counter on the right — per the mockup. */
export function Pagination({
  index,
  total,
  activeColor,
  inactiveColor,
  counterColor,
}: PaginationProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: index + 1 }}
    >
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {Array.from({ length: total }, (_, dot) => (
          <View
            key={dot}
            style={{
              height: 6,
              width: dot === index ? 22 : 6,
              borderRadius: radius.full,
              backgroundColor: dot === index ? activeColor : inactiveColor,
              opacity: dot === index ? 1 : 0.5,
            }}
          />
        ))}
      </View>

      <Text style={[typography.caption, { color: counterColor }]}>
        {index + 1 + "/" + total}
      </Text>
    </View>
  );
}
