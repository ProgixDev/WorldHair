import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { Text, View } from "react-native";
import { radius } from "../../../constants/spacing";
import { typography } from "../../../constants/typography";
import { useTheme } from "../../../contexts/ThemeContext";
import { initials } from "../../../features/salons/images";
import type { StaffMember } from "../../../features/pro/types";

/** A team member's photo, or their initials — a person icon when they have no name yet. */
export function MemberAvatar({
  member,
  size = 44,
}: {
  member: Pick<StaffMember, "firstName" | "lastName" | "photoUrl">;
  size?: number;
}) {
  const { theme } = useTheme();
  const letters = initials(`${member.firstName} ${member.lastName}`.trim());

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.primary.soft,
      }}
    >
      {member.photoUrl ? (
        <Image
          source={{ uri: member.photoUrl }}
          cachePolicy="memory-disk"
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={200}
        />
      ) : letters ? (
        <Text style={[typography.label, { color: theme.primary.main }]}>{letters}</Text>
      ) : (
        <MaterialCommunityIcons name="account-outline" size={size / 2} color={theme.primary.main} />
      )}
    </View>
  );
}
