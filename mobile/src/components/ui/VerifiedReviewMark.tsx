import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";

/** « Avis vérifié »: the client confirmed on the spot with the salon's end-of-service code. */
export function VerifiedReviewMark() {
  const { theme } = useTheme();

  return (
    <View
      accessible
      accessibilityLabel="Avis vérifié : le client a confirmé sa présence au rendez-vous"
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
    >
      <MaterialCommunityIcons name="check-decagram" size={13} color={theme.success} />
      <Text style={[typography.caption, { color: theme.success }]}>Avis vérifié</Text>
    </View>
  );
}
