import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { MIN_TOUCH_SIZE, radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

export type SocialProvider = "google" | "apple";

interface SocialButtonProps {
  provider: SocialProvider;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

const PROVIDERS: Record<
  SocialProvider,
  { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }
> = {
  google: { label: "Continuer avec Google", icon: "google" },
  apple: { label: "Continuer avec Apple", icon: "apple" },
};

/** Outlined provider button. The provider flow itself is mocked for now. */
export function SocialButton({
  provider,
  onPress,
  loading = false,
  disabled = false,
}: SocialButtonProps) {
  const { theme } = useTheme();
  const { label, icon } = PROVIDERS[provider];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH_SIZE,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: pressed ? theme.surface.raised : theme.surface.base,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        opacity: isDisabled ? 0.5 : 1,
        justifyContent: "center",
      })}
    >
      {loading ? (
        <ActivityIndicator color={theme.foreground.white} />
      ) : (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
          }}
        >
          <MaterialCommunityIcons
            name={icon}
            size={20}
            color={theme.foreground.white}
          />
          <Text
            style={[typography.bodyMedium, { color: theme.foreground.white }]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
