import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import type { AvailabilityDay } from "../../features/pro/types";
import { minutesToTime, weekdayLong } from "../../utils/date";

const STEP = 30;

/**
 * One weekday of the shop's opening hours: a switch, and — while open — an
 * opening/closing time stepper. Shared by the agenda's availability sheet
 * and the mandatory post-approval shop-profile screen (issue #7).
 */
export function AvailabilityRow({
  day,
  onChange,
}: {
  day: AvailabilityDay;
  onChange: (day: AvailabilityDay) => void;
}) {
  const { theme } = useTheme();
  const reference = new Date(2026, 7, 16 + day.weekday); // any week works

  return (
    <View
      style={{
        padding: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: theme.surface.base,
        borderWidth: 1,
        borderColor: theme.divider,
        gap: spacing.md,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={[typography.bodyMedium, { color: theme.foreground.white }]}
        >
          {weekdayLong(reference)}
        </Text>
        <Switch
          value={day.open}
          onValueChange={(open) => onChange({ ...day, open })}
          accessibilityLabel={"Ouvrir le " + weekdayLong(reference)}
          trackColor={{ false: theme.surface.sunken, true: theme.primary.main }}
          thumbColor={day.open ? theme.primary.on : theme.foreground.gray}
        />
      </View>

      {day.open ? (
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <TimeStepper
            label="Ouverture"
            value={day.opens}
            onChange={(opens) =>
              onChange({ ...day, opens: Math.min(opens, day.closes - 60) })
            }
          />
          <TimeStepper
            label="Fermeture"
            value={day.closes}
            onChange={(closes) =>
              onChange({ ...day, closes: Math.max(closes, day.opens + 60) })
            }
          />
        </View>
      ) : null}
    </View>
  );
}

function TimeStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const { theme } = useTheme();

  return (
    <View style={{ flex: 1, gap: spacing.xs }}>
      <Text style={[typography.caption, { color: theme.foreground.gray }]}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.sm,
          minHeight: 44,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: theme.border,
        }}
      >
        <Pressable
          onPress={() => onChange(Math.max(0, value - STEP))}
          accessibilityRole="button"
          accessibilityLabel={label + " moins 30 minutes"}
          hitSlop={6}
        >
          <MaterialCommunityIcons
            name="minus"
            size={18}
            color={theme.primary.main}
          />
        </Pressable>
        <Text
          style={[typography.label, { color: theme.foreground.white }]}
        >
          {minutesToTime(value)}
        </Text>
        <Pressable
          onPress={() => onChange(Math.min(24 * 60 - STEP, value + STEP))}
          accessibilityRole="button"
          accessibilityLabel={label + " plus 30 minutes"}
          hitSlop={6}
        >
          <MaterialCommunityIcons
            name="plus"
            size={18}
            color={theme.primary.main}
          />
        </Pressable>
      </View>
    </View>
  );
}
