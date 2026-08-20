import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { elevation } from "../../constants/elevation";
import { MIN_TOUCH_SIZE, radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Optional one-line explanation under the label. */
  hint?: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}

/** M3-flavoured segmented control — the role picker on sign-up. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedControlProps<T>) {
  const { theme } = useTheme();

  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <Text style={[typography.label, { color: theme.foreground.gray }]}>
          {label}
        </Text>
      ) : null}

      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: "row",
          gap: spacing.xs,
          padding: spacing.xs,
          borderRadius: radius.xl,
          backgroundColor: theme.surface.sunken,
          borderWidth: 1,
          borderColor: theme.divider,
        }}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[
                {
                  flex: 1,
                  minHeight: MIN_TOUCH_SIZE + 4,
                  borderRadius: radius.lg,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.sm,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  backgroundColor: selected
                    ? theme.primary.main
                    : "transparent",
                },
                selected ? elevation(1, theme.shadow) : null,
              ]}
            >
              <Text
                style={[
                  typography.label,
                  {
                    color: selected ? theme.primary.on : theme.foreground.white,
                    textAlign: "center",
                  },
                ]}
              >
                {option.label}
              </Text>
              {option.hint ? (
                <Text
                  style={[
                    typography.caption,
                    {
                      color: selected
                        ? theme.primary.on
                        : theme.foreground.gray,
                      textAlign: "center",
                      opacity: selected ? 0.8 : 1,
                    },
                  ]}
                >
                  {option.hint}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
