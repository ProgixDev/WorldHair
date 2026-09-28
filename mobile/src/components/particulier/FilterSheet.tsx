import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import {
  DEFAULT_FILTERS,
  DISTANCE_OPTIONS,
  OPEN_AFTER_OPTIONS,
  PRACTICE_ZONE_OPTIONS,
  PRICE_OPTIONS,
  SORT_OPTIONS,
  dayOptions,
  type SalonFilters,
} from "../../features/salons/filters";
import { SPECIALTIES } from "../../features/salons/types";
import { Button } from "../ui/Button";
import { BottomSheet } from "../ui/BottomSheet";
import { Chip } from "../ui/Chip";

interface FilterSheetProps {
  visible: boolean;
  filters: SalonFilters;
  /** How many salons a draft would show — asked from the server, so the CTA can say it. */
  countFor: (filters: SalonFilters) => Promise<number>;
  onApply: (filters: SalonFilters) => void;
  onClose: () => void;
}

/** A pause while chips are tapped in a row: one count per settled draft. */
const COUNT_DELAY_MS = 350;

/** Bottom sheet holding the search filters; edits are staged until "Voir". */
export function FilterSheet({
  visible,
  filters,
  countFor,
  onApply,
  onClose,
}: FilterSheetProps) {
  const { theme } = useTheme();
  const [draft, setDraft] = useState<SalonFilters>(filters);
  /** `null` while the server is counting. */
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setCount(null);
    const timer = setTimeout(() => {
      countFor(draft)
        .then((total) => {
          if (!cancelled) setCount(total);
        })
        .catch(() => {
          if (!cancelled) setCount(-1);
        });
    }, COUNT_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, draft, countFor]);

  const set = (patch: Partial<SalonFilters>) => setDraft((current) => ({ ...current, ...patch }));

  const toggleSpecialty = (id: SalonFilters["specialties"][number]) =>
    setDraft((current) => ({
      ...current,
      specialties: current.specialties.includes(id)
        ? current.specialties.filter((s) => s !== id)
        : [...current.specialties, id],
    }));

  const cta =
    count === null
      ? "Voir les salons"
      : count === 0
        ? "Aucun salon"
        : count < 0
          ? "Voir les salons"
          : "Voir " + count + (count > 1 ? " salons" : " salon");

  return (
    <BottomSheet
      visible={visible}
      title="Filtres"
      onClose={onClose}
      footer={
        <>
          <Button
            label="Réinitialiser"
            variant="outline"
            onPress={() => setDraft({ ...DEFAULT_FILTERS, query: draft.query })}
            style={{ flex: 1 }}
          />
          <Button
            label={cta}
            onPress={() => onApply(draft)}
            disabled={count === 0}
            style={{ flex: 1.4 }}
          />
        </>
      }
    >
      <Section title="Prestation">
        <Wrap>
          {SPECIALTIES.map((specialty) => (
            <Chip
              key={specialty.id}
              label={specialty.label}
              selected={draft.specialties.includes(specialty.id)}
              onPress={() => toggleSpecialty(specialty.id)}
            />
          ))}
        </Wrap>
      </Section>

      <Section title="Budget">
        <Wrap>
          <Chip
            label="Tous les prix"
            selected={draft.priceMin === null && draft.priceMax === null}
            onPress={() => set({ priceMin: null, priceMax: null })}
          />
          {PRICE_OPTIONS.map((option) => (
            <Chip
              key={option.label}
              label={option.label}
              selected={draft.priceMin === option.min && draft.priceMax === option.max}
              onPress={() => set({ priceMin: option.min, priceMax: option.max })}
            />
          ))}
        </Wrap>
      </Section>

      <Section title="Quand">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          <Chip label="Peu importe" selected={draft.openWhen === null} onPress={() => set({ openWhen: null })} />
          <Chip
            label="Ouvert maintenant"
            icon="clock-outline"
            selected={draft.openWhen === "now"}
            onPress={() => set({ openWhen: "now", openAfter: null })}
          />
          {dayOptions(7).map((day) => (
            <Chip key={day.key} label={day.label} selected={draft.openWhen === day.key} onPress={() => set({ openWhen: day.key })} />
          ))}
        </ScrollView>
      </Section>

      {draft.openWhen !== "now" ? (
        <Section title="Ouvert après">
          <Wrap>
            <Chip label="Peu importe" selected={draft.openAfter === null} onPress={() => set({ openAfter: null })} />
            {OPEN_AFTER_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={draft.openAfter === option.value}
                onPress={() => set({ openAfter: option.value })}
              />
            ))}
          </Wrap>
        </Section>
      ) : null}

      <Section title="Où">
        <Wrap>
          {PRACTICE_ZONE_OPTIONS.map((option) => (
            <Chip
              key={option.label}
              label={option.label}
              icon={option.value === "domicile" ? "home-outline" : undefined}
              selected={draft.practiceZone === option.value}
              onPress={() => set({ practiceZone: option.value })}
            />
          ))}
        </Wrap>
      </Section>

      <Section title="Distance maximale">
        <Wrap>
          {DISTANCE_OPTIONS.map((option) => (
            <Chip
              key={option.label}
              label={option.label}
              selected={draft.maxDistanceKm === option.value}
              onPress={() => set({ maxDistanceKm: option.value })}
            />
          ))}
        </Wrap>
      </Section>

      <Section title="Trier par">
        <View style={{ gap: spacing.sm }}>
          {SORT_OPTIONS.map((option) => {
            const selected = draft.sort === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => set({ sort: option.value })}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  minHeight: 56,
                  paddingHorizontal: spacing.lg,
                  borderRadius: radius.lg,
                  borderWidth: 1.5,
                  borderColor: selected ? theme.primary.main : theme.divider,
                  backgroundColor: selected
                    ? theme.primary.soft
                    : theme.surface.base,
                }}
              >
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: radius.full,
                    borderWidth: 2,
                    borderColor: selected ? theme.primary.main : theme.border,
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
                <Text style={[typography.body, { color: theme.foreground.white }]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>
    </BottomSheet>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>{children}</View>;
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
