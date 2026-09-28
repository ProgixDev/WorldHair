import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";
import { radius } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import { nextSlotLabel } from "../../features/salons/filters";
import type { Salon } from "../../features/salons/types";

/** "Dispo aujourd'hui 14:30" — nothing when the salon can't be booked online or is full for two weeks. */
export function NextSlotLine({ salon }: { salon: Salon }) {
  const { theme } = useTheme();
  if (!salon.nextSlot) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View style={{ width: 6, height: 6, borderRadius: radius.full, backgroundColor: theme.success }} />
      <Text style={[typography.caption, { color: theme.success, flexShrink: 1 }]} numberOfLines={1}>
        {nextSlotLabel(salon.nextSlot)}
      </Text>
    </View>
  );
}

/** "À domicile · 25 km" for a coiffeur who comes to the client; nothing for a salon. */
export function HomeServiceTag({ salon }: { salon: Salon }) {
  const { theme } = useTheme();
  if (salon.practiceZone !== "domicile") return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <MaterialCommunityIcons name="home-outline" size={13} color={theme.primary.main} />
      <Text style={[typography.caption, { color: theme.primary.main }]} numberOfLines={1}>
        {"À domicile" + (salon.travelRadiusKm ? " · " + salon.travelRadiusKm + " km" : "")}
      </Text>
    </View>
  );
}
