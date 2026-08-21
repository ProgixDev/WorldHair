import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { elevation } from "../../constants/elevation";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";

/**
 * Shared "settings list" system: a bordered, elevated card of icon rows.
 * Both account tabs (particulier and pro) render their settings through
 * this, so the two spaces never drift into two hand-rolled row styles.
 */

export function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={[typography.overline, { color: theme.foreground.gray }]}>
        {title.toUpperCase()}
      </Text>
      <View
        style={[
          {
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: theme.divider,
            overflow: "hidden",
          },
          elevation(1, theme.shadow),
        ]}
      >
        {children}
      </View>
    </View>
  );
}

interface RowShellProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value?: string;
  tone?: "default" | "danger";
  /** Trailing element — a chevron, a Switch, or nothing for a read-only row. */
  right?: React.ReactNode;
  onPress?: () => void;
  isLast?: boolean;
  /** Value text color override — e.g. an "open" state standing out from a muted default. */
  valueColor?: string;
}

export function RowShell({
  icon,
  label,
  value,
  tone = "default",
  right,
  onPress,
  isLast,
  valueColor,
}: RowShellProps) {
  const { theme } = useTheme();
  const color = tone === "danger" ? theme.danger : theme.primary.main;

  const content = (pressed: boolean) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        minHeight: 64,
        borderBottomWidth: isLast ? 0 : 1,
        borderColor: theme.divider,
        backgroundColor:
          pressed && onPress ? theme.surface.raised : theme.surface.base,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: radius.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor:
            tone === "danger" ? theme.danger + "1f" : theme.primary.soft,
        }}
      >
        <MaterialCommunityIcons name={icon} size={19} color={color} />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={[
            typography.bodyMedium,
            {
              color: tone === "danger" ? theme.danger : theme.foreground.white,
            },
          ]}
        >
          {label}
        </Text>
        {value ? (
          <Text
            style={[
              typography.caption,
              { color: valueColor ?? theme.foreground.gray },
            ]}
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : null}
      </View>

      {right ?? null}
    </View>
  );

  if (!onPress) return content(false);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}

export function Row(
  props: Omit<RowShellProps, "right"> & { onPress: () => void },
) {
  const { theme } = useTheme();
  return (
    <RowShell
      {...props}
      right={
        <MaterialCommunityIcons
          name="chevron-right"
          size={18}
          color={theme.foreground.gray}
        />
      }
    />
  );
}

export function ToggleRow({
  icon,
  label,
  value,
  enabled,
  onChange,
  isLast,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value?: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  isLast?: boolean;
}) {
  const { theme } = useTheme();

  return (
    <RowShell
      icon={icon}
      label={label}
      value={value}
      isLast={isLast}
      right={
        <Switch
          value={enabled}
          onValueChange={onChange}
          accessibilityLabel={label}
          trackColor={{ false: theme.surface.sunken, true: theme.primary.main }}
          thumbColor={enabled ? theme.primary.on : theme.foreground.gray}
        />
      }
    />
  );
}
