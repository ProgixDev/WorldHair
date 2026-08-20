import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Plain string label, or rich content (e.g. an inline CGU link). */
  children: React.ReactNode;
  error?: string;
  accessibilityLabel: string;
}

export function Checkbox({
  checked,
  onChange,
  children,
  error,
  accessibilityLabel,
}: CheckboxProps) {
  const { theme } = useTheme();

  return (
    <View style={{ gap: spacing.xs }}>
      <Pressable
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={accessibilityLabel}
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: spacing.md,
          paddingVertical: spacing.sm,
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: radius.sm,
            borderWidth: checked ? 0 : 2,
            borderColor: error ? theme.danger : theme.border,
            backgroundColor: checked ? theme.primary.main : "transparent",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 1,
          }}
        >
          {checked ? (
            <MaterialCommunityIcons
              name="check"
              size={16}
              color={theme.primary.on}
            />
          ) : null}
        </View>

        <View style={{ flex: 1 }}>{children}</View>
      </Pressable>

      {error ? (
        <Text style={[typography.caption, { color: theme.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
