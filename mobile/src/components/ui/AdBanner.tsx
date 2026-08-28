import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import type { AdSlot } from "../../services/ads";

/**
 * Admin-managed ad banner (issue #5): the uploaded photo once a real one
 * exists, an icon panel until then. Tapping opens `linkUrl` when set.
 */
export function AdBanner({ slot }: { slot: AdSlot }) {
  const { theme } = useTheme();
  const openable = Boolean(slot.linkUrl);

  return (
    <Pressable
      onPress={openable ? () => void Linking.openURL(slot.linkUrl!) : undefined}
      disabled={!openable}
      accessibilityRole={openable ? "link" : undefined}
      accessibilityLabel={"Publicité — " + slot.headline}
      style={({ pressed }) => ({
        borderRadius: radius.xl,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface.base,
        opacity: pressed && openable ? 0.85 : 1,
      })}
    >
      <View style={{ height: 96 }}>
        {slot.imageUri ? (
          <Image
            source={{ uri: slot.imageUri }}
            style={{ flex: 1 }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.accent.warmSoft,
            }}
          >
            <MaterialCommunityIcons
              name="tag-heart-outline"
              size={32}
              color={theme.accent.warm}
            />
          </View>
        )}
      </View>

      <View style={{ padding: spacing.md, gap: 2 }}>
        <Text style={[typography.overline, { color: theme.foreground.gray }]}>
          PUBLICITÉ
        </Text>
        <Text
          style={[typography.bodySmall, { color: theme.foreground.white }]}
          numberOfLines={2}
        >
          {slot.headline}
        </Text>
      </View>
    </Pressable>
  );
}
