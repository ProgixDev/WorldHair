import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { usePro } from "../../contexts/ProContext";
import { useTheme } from "../../contexts/ThemeContext";
import { describeClosure, hoursRange, wholeDaysRange } from "../../features/pro/closures";
import { closuresOf } from "../../features/pro/team";
import type { TimeOff } from "../../features/pro/types";
import { proErrorMessage } from "../../services/pro";
import { addDays, dayAndMonth, minutesToTime, relativeDay, startOfDay, timeOfDay, weekdayShort } from "../../utils/date";
import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { SegmentedControl } from "../ui/SegmentedControl";
import { TextField } from "../ui/TextField";

const DAYS_AHEAD = 120;
/** Half-hour marks from 06:00 to 22:00 for a few-hours closure. */
const TIMES = Array.from({ length: 33 }, (_, index) => 6 * 60 + index * 30);

type Kind = "days" | "hours";

/**
 * "Congés et fermetures": whole days (holidays) or a few hours of one day
 * (an afternoon off). Nothing can be booked inside one. Bookings already
 * inside a new closure are kept and listed, for the coiffeur to move or
 * cancel from the agenda (the client is told either way).
 *
 * Without `staffId` (the agenda's « Fermetures »), the whole salon closes;
 * with it (Équipe, TODO.md Phase 3), it's that one person's congés — no
 * booking goes to them meanwhile, the rest of the team stays bookable.
 */
export function ClosuresSheet({
  visible,
  onClose,
  staffId,
  personName,
}: {
  visible: boolean;
  onClose: () => void;
  /** One person's congés; absent: the salon's own closures. */
  staffId?: string;
  /** Shown in the title of one person's congés. */
  personName?: string;
}) {
  const { theme } = useTheme();
  const { timeOff, team, addTimeOff, deleteTimeOff } = usePro();
  const forPerson = staffId !== undefined;
  const closures = useMemo(() => closuresOf(timeOff, staffId ?? null), [timeOff, staffId]);

  const days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: DAYS_AHEAD }, (_, offset) => addDays(today, offset));
  }, []);

  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<Kind>("days");
  const [from, setFrom] = useState<Date>(days[0]);
  const [to, setTo] = useState<Date>(days[0]);
  const [fromMinute, setFromMinute] = useState(14 * 60);
  const [toMinute, setToMinute] = useState(19 * 60);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setAdding(false);
      setError(null);
    }
  }, [visible]);

  const pickFrom = (day: Date) => {
    setFrom(day);
    if (to.getTime() < day.getTime()) setTo(day);
  };

  const pickFromMinute = (minute: number) => {
    setFromMinute(minute);
    if (toMinute <= minute) setToMinute(Math.min(minute + 60, 22 * 60));
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const range = kind === "days" ? wholeDaysRange(from, to) : hoursRange(from, fromMinute, toMinute);
      const conflicts = await addTimeOff({
        ...range,
        label: label.trim() || undefined,
        ...(staffId ? { staffId } : {}),
      });
      setAdding(false);
      setLabel("");
      if (conflicts.length > 0) {
        const what = forPerson ? "ce congé" : "cette fermeture";
        Alert.alert(
          conflicts.length > 1
            ? conflicts.length + " rendez-vous pendant " + what
            : "1 rendez-vous pendant " + what,
          conflicts
            .map((conflict) => {
              const start = new Date(conflict.startsAt);
              return "• " + relativeDay(start) + " " + timeOfDay(start) + " — " + conflict.serviceName;
            })
            .join("\n") +
            (forPerson
              ? "\n\nIls sont conservés : donnez-les à quelqu'un d'autre, déplacez-les ou annulez-les depuis l'agenda."
              : "\n\nIls sont conservés : déplacez-les ou annulez-les depuis l'agenda, le client sera prévenu."),
        );
      }
    } catch (err) {
      setError(proErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (closure: TimeOff) =>
    Alert.alert(forPerson ? "Supprimer ce congé ?" : "Supprimer cette fermeture ?", describeClosure(closure), [
      { text: "Garder", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => void deleteTimeOff(closure.id).catch((err) => setError(proErrorMessage(err))),
      },
    ]);

  const dayChips = (selected: Date, onPick: (day: Date) => void, notBefore?: Date) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
      {days
        .filter((day) => !notBefore || day.getTime() >= notBefore.getTime())
        .map((day) => (
          <Chip
            key={day.toISOString()}
            label={weekdayShort(day) + " " + dayAndMonth(day)}
            selected={day.getTime() === selected.getTime()}
            onPress={() => onPick(day)}
          />
        ))}
    </ScrollView>
  );

  const timeChips = (selected: number, onPick: (minute: number) => void, after?: number) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
      {TIMES.filter((minute) => after === undefined || minute > after).map((minute) => (
        <Chip
          key={minute}
          label={minutesToTime(minute)}
          selected={minute === selected}
          onPress={() => onPick(minute)}
        />
      ))}
    </ScrollView>
  );

  const title = forPerson
    ? adding
      ? "Nouveau congé"
      : personName
        ? "Congés · " + personName
        : "Congés"
    : adding
      ? "Nouvelle fermeture"
      : "Congés et fermetures";

  return (
    <BottomSheet
      visible={visible}
      title={title}
      onClose={onClose}
      footer={
        adding ? (
          <>
            <Button label="Retour" variant="outline" onPress={() => setAdding(false)} style={{ flex: 1 }} />
            <Button
              label="Enregistrer"
              onPress={() => void save()}
              loading={busy}
              background={theme.primary.main}
              color={theme.primary.on}
              style={{ flex: 1.3 }}
            />
          </>
        ) : (
          <>
            <Button label="Fermer" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button
              label="Ajouter"
              onPress={() => setAdding(true)}
              background={theme.primary.main}
              color={theme.primary.on}
              style={{ flex: 1.3 }}
            />
          </>
        )
      }
    >
      {adding ? (
        <View style={{ gap: spacing.lg }}>
          <SegmentedControl<Kind>
            options={[
              { value: "days", label: "Journées entières" },
              { value: "hours", label: "Quelques heures" },
            ]}
            value={kind}
            onChange={setKind}
          />

          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.overline, { color: theme.foreground.gray }]}>
              {kind === "days" ? "PREMIER JOUR" : "JOUR"}
            </Text>
            {dayChips(from, pickFrom)}
          </View>

          {kind === "days" ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.overline, { color: theme.foreground.gray }]}>DERNIER JOUR</Text>
              {dayChips(to, setTo, from)}
            </View>
          ) : (
            <>
              <View style={{ gap: spacing.sm }}>
                <Text style={[typography.overline, { color: theme.foreground.gray }]}>DE</Text>
                {timeChips(fromMinute, pickFromMinute)}
              </View>
              <View style={{ gap: spacing.sm }}>
                <Text style={[typography.overline, { color: theme.foreground.gray }]}>À</Text>
                {timeChips(toMinute, setToMinute, fromMinute)}
              </View>
            </>
          )}

          <TextField
            label={forPerson ? "Motif (jamais montré aux clients)" : "Motif (vous seul le voyez)"}
            value={label}
            onChangeText={setLabel}
            placeholder="Congés, formation…"
            maxLength={60}
          />
        </View>
      ) : closures.length === 0 ? (
        <Text style={[typography.bodySmall, { color: theme.foreground.gray }]}>
          {forPerson
            ? "Aucun congé prévu. Pendant un congé, aucun rendez-vous ne lui est donné ; le reste de l'équipe reste réservable."
            : "Aucune fermeture prévue. Ajoutez vos congés ou une fermeture exceptionnelle : personne ne pourra réserver pendant ce temps."}
        </Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {closures.map((closure) => (
            <View
              key={closure.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.md,
                borderRadius: radius.lg,
                backgroundColor: theme.surface.base,
              }}
            >
              <MaterialCommunityIcons name="calendar-remove-outline" size={20} color={theme.foreground.gray} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[typography.bodySmall, { color: theme.foreground.white }]}>
                  {describeClosure(closure)}
                </Text>
                {closure.label ? (
                  <Text style={[typography.caption, { color: theme.foreground.gray }]}>{closure.label}</Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => confirmDelete(closure)}
                accessibilityRole="button"
                accessibilityLabel={(forPerson ? "Supprimer le congé " : "Supprimer la fermeture ") + describeClosure(closure)}
                hitSlop={8}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={20} color={theme.danger} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* The salon's closures shut everyone; one person's congés live in Équipe. */}
      {!forPerson && !adding && team.length > 1 ? (
        <Text style={[typography.caption, { color: theme.foreground.gray }]}>
          Ici, le salon entier ferme. Les congés d&apos;une seule personne se gèrent dans Compte › Équipe.
        </Text>
      ) : null}

      {error ? <Text style={[typography.bodySmall, { color: theme.danger }]}>{error}</Text> : null}
    </BottomSheet>
  );
}
