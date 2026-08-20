import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import { Button } from "./Button";

interface EmptyStateProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  message: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        alignItems: "center",
        gap: spacing.lg,
        paddingVertical: spacing.xxl,
        paddingHorizontal: spacing.lg,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.surface.base,
          borderWidth: 1,
          borderColor: theme.border,
        }}
      >
        <MaterialCommunityIcons
          name={icon}
          size={30}
          color={theme.foreground.gray}
        />
      </View>

      <View style={{ gap: spacing.xs, alignItems: "center" }}>
        <Text
          style={[
            typography.h2,
            { color: theme.foreground.white, textAlign: "center" },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            typography.bodySmall,
            { color: theme.foreground.gray, textAlign: "center" },
          ]}
        >
          {message}
        </Text>
      </View>

      {action ? <Button label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}
