import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { MIN_TOUCH_SIZE, radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

interface AuthHeaderProps {
  title: string;
  subtitle?: string;
  /** Back chevron — hidden on the first screen of a flow. */
  onBack?: () => void;
  showBack?: boolean;
  /** 1-based step, rendered as a progress rail (coiffeur wizard). */
  step?: { current: number; total: number };
}

/** Shared top block for every auth screen: back, step rail, title, subtitle. */
export function AuthHeader({
  title,
  subtitle,
  onBack,
  showBack = true,
  step,
}: AuthHeaderProps) {
  const { theme } = useTheme();
  const router = useRouter();

  const handleBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
  };

  return (
    <View style={{ gap: spacing.md, paddingTop: spacing.sm }}>
      {showBack ? (
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={8}
          style={{
            width: MIN_TOUCH_SIZE,
            height: MIN_TOUCH_SIZE,
            marginLeft: -spacing.md,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={28}
            color={theme.foreground.white}
          />
        </Pressable>
      ) : null}

      {step ? (
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: "row", gap: spacing.xs }}>
            {Array.from({ length: step.total }, (_, index) => (
              <View
                key={index}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: radius.full,
                  backgroundColor:
                    index < step.current
                      ? theme.primary.main
                      : theme.background.accent,
                }}
              />
            ))}
          </View>
          <Text style={[typography.overline, { color: theme.foreground.gray }]}>
            {"ÉTAPE " + step.current + " / " + step.total}
          </Text>
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Text style={[typography.h1, { color: theme.foreground.white }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[typography.body, { color: theme.foreground.gray }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
