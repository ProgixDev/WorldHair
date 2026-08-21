import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import { DEMO_PERSONAS, type DemoPersona } from "../../services/auth";

interface DemoLoginBarProps {
  onSelect: (persona: DemoPersona) => void;
  /** Persona currently signing in, if any. */
  pending?: DemoPersona | null;
  disabled?: boolean;
}

const ICONS: Record<DemoPersona, keyof typeof MaterialCommunityIcons.glyphMap> =
  {
    particulier: "account-outline",
    coiffeur_active: "content-cut",
    coiffeur_pending: "clock-outline",
    coiffeur_rejected: "alert-circle-outline",
  };

/**
 * Dev-only shortcut row: one chip per account state, each signing straight in.
 * Delete this component (and `signInAsDemo`) when the real API lands.
 */
export function DemoLoginBar({
  onSelect,
  pending = null,
  disabled = false,
}: DemoLoginBarProps) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        padding: spacing.lg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: theme.border,
        gap: spacing.md,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
      >
        <MaterialCommunityIcons
          name="flask-outline"
          size={16}
          color={theme.foreground.gray}
        />
        <Text style={[typography.label, { color: theme.foreground.gray }]}>
          Mode démo — connexion directe
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {DEMO_PERSONAS.map((persona) => {
          const busy = pending === persona.id;
          return (
            <Pressable
              key={persona.id}
              onPress={() => onSelect(persona.id)}
              disabled={disabled || pending !== null}
              accessibilityRole="button"
              accessibilityLabel={
                "Connexion démo : " + persona.label + ". " + persona.hint
              }
              accessibilityState={{
                busy,
                disabled: disabled || pending !== null,
              }}
              style={({ pressed }) => ({
                flexGrow: 1,
                flexBasis: "45%",
                minHeight: 64,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: busy ? theme.primary.main : theme.border,
                backgroundColor: pressed
                  ? theme.surface.raised
                  : theme.surface.base,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                justifyContent: "center",
                gap: 2,
                opacity: disabled || (pending !== null && !busy) ? 0.5 : 1,
              })}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                }}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={theme.primary.main} />
                ) : (
                  <MaterialCommunityIcons
                    name={ICONS[persona.id]}
                    size={16}
                    color={theme.primary.main}
                  />
                )}
                <Text
                  style={[typography.label, { color: theme.foreground.white }]}
                  numberOfLines={1}
                >
                  {persona.label}
                </Text>
              </View>
              <Text
                style={[typography.caption, { color: theme.foreground.gray }]}
              >
                {persona.hint}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
