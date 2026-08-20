import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import {
  DEFAULT_FILTERS,
  DISTANCE_OPTIONS,
  SORT_OPTIONS,
  type SalonFilters,
} from "../../features/salons/filters";
import { SPECIALTIES } from "../../features/salons/types";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";

interface FilterSheetProps {
  visible: boolean;
  filters: SalonFilters;
  /** Live count for the current draft, so the CTA can say what it will show. */
  countFor: (filters: SalonFilters) => number;
  onApply: (filters: SalonFilters) => void;
  onClose: () => void;
}

/** Bottom sheet holding the search filters; edits are staged until "Voir". */
export function FilterSheet({
  visible,
  filters,
  countFor,
  onApply,
  onClose,
}: FilterSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<SalonFilters>(filters);

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const toggleSpecialty = (id: SalonFilters["specialties"][number]) =>
    setDraft((current) => ({
      ...current,
      specialties: current.specialties.includes(id)
        ? current.specialties.filter((s) => s !== id)
        : [...current.specialties, id],
    }));

  const count = countFor(draft);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        accessibilityLabel="Fermer les filtres"
        style={{ flex: 1, backgroundColor: "#00000099" }}
      />

      <View
        style={{
          backgroundColor: theme.background.darker,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          borderTopWidth: 1,
          borderColor: theme.border,
          paddingBottom: Math.max(insets.bottom, spacing.lg),
          maxHeight: "80%",
        }}
      >
        <View style={{ alignItems: "center", paddingVertical: spacing.md }}>
          <View
            style={{
              width: 44,
              height: 4,
              borderRadius: radius.full,
              backgroundColor: theme.border,
            }}
          />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing.lg,
            gap: spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[typography.h2, { color: theme.foreground.white }]}>
            Filtres
          </Text>

          <Section title="Prestation">
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.sm,
              }}
            >
              {SPECIALTIES.map((specialty) => (
                <Chip
                  key={specialty.id}
                  label={specialty.label}
                  selected={draft.specialties.includes(specialty.id)}
                  onPress={() => toggleSpecialty(specialty.id)}
                />
              ))}
            </View>
          </Section>

          <Section title="Distance maximale">
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.sm,
              }}
            >
              {DISTANCE_OPTIONS.map((option) => (
                <Chip
                  key={option.label}
                  label={option.label}
                  selected={draft.maxDistanceKm === option.value}
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      maxDistanceKm: option.value,
                    }))
                  }
                />
              ))}
            </View>
          </Section>

          <Section title="Trier par">
            <View style={{ gap: spacing.sm }}>
              {SORT_OPTIONS.map((option) => {
                const selected = draft.sort === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() =>
                      setDraft((current) => ({
                        ...current,
                        sort: option.value,
                      }))
                    }
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      minHeight: 48,
                      paddingHorizontal: spacing.lg,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: selected ? theme.primary.main : theme.border,
                      backgroundColor: theme.background.accent,
                    }}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: radius.full,
                        borderWidth: 2,
                        borderColor: selected
                          ? theme.primary.main
                          : theme.border,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {selected ? (
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: radius.full,
                            backgroundColor: theme.primary.main,
                          }}
                        />
                      ) : null}
                    </View>
                    <Text
                      style={[
                        typography.body,
                        { color: theme.foreground.white },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>
        </ScrollView>

        <View
          style={{
            flexDirection: "row",
            gap: spacing.md,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.md,
            borderTopWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Button
            label="Réinitialiser"
            variant="outline"
            onPress={() => setDraft({ ...DEFAULT_FILTERS, query: draft.query })}
            style={{ flex: 1 }}
          />
          <Button
            label={
              count === 0
                ? "Aucun salon"
                : "Voir " + count + (count > 1 ? " salons" : " salon")
            }
            onPress={() => onApply(draft)}
            disabled={count === 0}
            style={{ flex: 1.4 }}
          />
        </View>
      </View>
    </Modal>
  );
}

function Section({
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
      {children}
    </View>
  );
}
