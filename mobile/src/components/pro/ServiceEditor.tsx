import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { TextField } from "../ui/TextField";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import { SPECIALTIES } from "../../features/salons/types";
import type { ProService } from "../../features/pro/types";
import { formatDuration, formatPrice } from "../../utils/date";

const DURATION_STEP = 15;

/** Shared by pro/salon.tsx ("Mon salon") and pro-shop-setup.tsx (mandatory first-run setup) — same add/edit sheet either way. */
export function ServiceEditor({
  service,
  onClose,
  onSave,
}: {
  service: ProService | null;
  onClose: () => void;
  onSave: (service: ProService) => Promise<void>;
}) {
  const { theme } = useTheme();
  const [draft, setDraft] = useState<ProService | null>(service);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(service), [service]);

  if (!draft) return null;

  const valid = draft.name.trim().length >= 2 && draft.price > 0;

  return (
    <BottomSheet
      visible={service !== null}
      title={service?.name ? "Modifier la prestation" : "Nouvelle prestation"}
      onClose={onClose}
      footer={
        <>
          <Button
            label="Annuler"
            variant="outline"
            onPress={onClose}
            style={{ flex: 1 }}
          />
          <Button
            label="Enregistrer"
            onPress={async () => {
              setSaving(true);
              try {
                await onSave({ ...draft, name: draft.name.trim() });
              } finally {
                setSaving(false);
              }
            }}
            disabled={!valid}
            loading={saving}
            background={theme.primary.main}
            color={theme.primary.on}
            style={{ flex: 1.3 }}
          />
        </>
      }
    >
      <TextField
        label="Nom de la prestation"
        value={draft.name}
        onChangeText={(name) => setDraft({ ...draft, name })}
        placeholder="Coupe & brushing"
        autoCapitalize="sentences"
      />

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Stepper
          label="Prix"
          value={formatPrice(draft.price)}
          onMinus={() =>
            setDraft({ ...draft, price: Math.max(5, draft.price - 5) })
          }
          onPlus={() => setDraft({ ...draft, price: draft.price + 5 })}
        />
        <Stepper
          label="Durée"
          value={formatDuration(draft.durationMin)}
          onMinus={() =>
            setDraft({
              ...draft,
              durationMin: Math.max(15, draft.durationMin - DURATION_STEP),
            })
          }
          onPlus={() =>
            setDraft({
              ...draft,
              durationMin: Math.min(360, draft.durationMin + DURATION_STEP),
            })
          }
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={[typography.label, { color: theme.foreground.gray }]}>
          Famille
        </Text>
        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
        >
          {SPECIALTIES.map((specialty) => (
            <Chip
              key={specialty.id}
              label={specialty.label}
              selected={draft.specialty === specialty.id}
              onPress={() => setDraft({ ...draft, specialty: specialty.id })}
            />
          ))}
        </View>
      </View>

      <TextField
        label="Détail (optionnel)"
        value={draft.description ?? ""}
        onChangeText={(description) => setDraft({ ...draft, description })}
        placeholder="Shampooing, coupe et coiffage"
        autoCapitalize="sentences"
        multiline
        maxLength={140}
      />
    </BottomSheet>
  );
}

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, gap: spacing.xs }}>
      <Text style={[typography.label, { color: theme.foreground.gray }]}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.md,
          minHeight: 56,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface.base,
        }}
      >
        <Pressable
          onPress={onMinus}
          accessibilityRole="button"
          accessibilityLabel={label + " diminuer"}
          hitSlop={8}
        >
          <MaterialCommunityIcons
            name="minus-circle-outline"
            size={22}
            color={theme.primary.main}
          />
        </Pressable>
        <Text
          style={[typography.bodyMedium, { color: theme.foreground.white }]}
        >
          {value}
        </Text>
        <Pressable
          onPress={onPlus}
          accessibilityRole="button"
          accessibilityLabel={label + " augmenter"}
          hitSlop={8}
        >
          <MaterialCommunityIcons
            name="plus-circle-outline"
            size={22}
            color={theme.primary.main}
          />
        </Pressable>
      </View>
    </View>
  );
}
