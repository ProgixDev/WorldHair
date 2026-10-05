import React, { useEffect, useState } from "react";
import { Alert, Switch, Text, View } from "react-native";
import { spacing } from "../../../constants/spacing";
import { typography } from "../../../constants/typography";
import { usePro } from "../../../contexts/ProContext";
import { useTheme } from "../../../contexts/ThemeContext";
import {
  closuresOf,
  memberName,
  nobodyElseTakesBookings,
  removeStaffRefusal,
  sameWeek,
  weekSummary,
  weekToEdit,
} from "../../../features/pro/team";
import type { AvailabilityDay, StaffMember } from "../../../features/pro/types";
import { proErrorMessage } from "../../../services/pro";
import { BottomSheet } from "../../ui/BottomSheet";
import { Button } from "../../ui/Button";
import { SegmentedControl } from "../../ui/SegmentedControl";
import { Group, Row, RowShell } from "../../ui/SettingsList";
import { AvailabilityRow } from "../AvailabilityEditor";
import { MemberAvatar } from "./MemberAvatar";

type HoursMode = "salon" | "custom";

/**
 * One person of the team, as the owner manages them (TODO.md Phase 3):
 * whether clients' bookings go to them, their week (the salon's hours, or
 * their own inside them), their congés, and removing them. The switch saves
 * at once; the week is a draft saved with « Enregistrer ».
 */
export function MemberSheet({
  member,
  visible,
  onClose,
  onOpenClosures,
}: {
  member: StaffMember | null;
  visible: boolean;
  onClose: () => void;
  /** « Congés »: the screen swaps this sheet for that person's ClosuresSheet. */
  onOpenClosures: (member: StaffMember) => void;
}) {
  const { theme } = useTheme();
  const { team, availability, timeOff, setTakesBookings, saveStaffHours, removeStaff } = usePro();

  const [mode, setMode] = useState<HoursMode>("salon");
  const [draft, setDraft] = useState<AvailabilityDay[]>([]);
  /** Bumped to throw the draft away (« Annuler », closing). */
  const [resetCount, setResetCount] = useState(0);
  const [pendingBookings, setPendingBookings] = useState<boolean | null>(null);
  const [savingHours, setSavingHours] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Back to what's stored for another person, after a save, or on reset —
  // not on every team refresh, which would wipe an edit in progress.
  const memberId = member?.id ?? null;
  const storedKey = JSON.stringify(member?.availability ?? null);
  useEffect(() => {
    const stored = JSON.parse(storedKey) as AvailabilityDay[] | null;
    setMode(stored ? "custom" : "salon");
    setDraft(weekToEdit(stored, availability));
    setError(null);
  }, [memberId, storedKey, availability, resetCount]);

  if (!member) {
    return (
      <BottomSheet visible={false} title="" onClose={onClose}>
        {null}
      </BottomSheet>
    );
  }

  const name = memberName(member);
  const stored = member.availability;
  const hoursChanged = mode === "salon" ? stored !== null : !sameWeek(draft, stored);
  const takesBookings = pendingBookings ?? member.takesBookings;
  const daysOffCount = closuresOf(timeOff, member.id).length;
  const salonOpen = availability.some((day) => day.open);

  const close = () => {
    setResetCount((count) => count + 1);
    onClose();
  };

  const applyBookings = async (next: boolean) => {
    setPendingBookings(next);
    setError(null);
    try {
      await setTakesBookings(member.id, next);
    } catch (err) {
      setError(proErrorMessage(err));
    } finally {
      setPendingBookings(null);
    }
  };

  const toggleBookings = (next: boolean) => {
    if (!next && nobodyElseTakesBookings(team, member.id)) {
      Alert.alert(
        "Plus personne ne prendra de rendez-vous",
        "Vos clients ne pourront plus réserver en ligne tant que personne de l'équipe ne prend de rendez-vous.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Désactiver", style: "destructive", onPress: () => void applyBookings(false) },
        ],
      );
      return;
    }
    void applyBookings(next);
  };

  const saveHours = async () => {
    setSavingHours(true);
    setError(null);
    try {
      await saveStaffHours(member.id, mode === "salon" ? null : draft);
    } catch (err) {
      setError(proErrorMessage(err));
    } finally {
      setSavingHours(false);
    }
  };

  const remove = async () => {
    setRemoving(true);
    setError(null);
    try {
      await removeStaff(member.id);
      close();
    } catch (err) {
      const refusal = removeStaffRefusal(err);
      if (refusal) Alert.alert("Impossible de retirer " + name, refusal);
      else setError(proErrorMessage(err));
    } finally {
      setRemoving(false);
    }
  };

  const confirmRemove = () =>
    Alert.alert(
      "Retirer " + name + " de l'équipe ?",
      "Son compte reste ouvert, mais l'agenda du salon lui est fermé et plus aucun rendez-vous ne lui est donné.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Retirer", style: "destructive", onPress: () => void remove() },
      ],
    );

  return (
    <BottomSheet
      visible={visible}
      title={name}
      onClose={close}
      footer={
        hoursChanged ? (
          <>
            <Button
              label="Annuler"
              variant="outline"
              onPress={() => setResetCount((count) => count + 1)}
              disabled={savingHours}
              style={{ flex: 1 }}
            />
            <Button
              label="Enregistrer"
              onPress={() => void saveHours()}
              loading={savingHours}
              background={theme.primary.main}
              color={theme.primary.on}
              style={{ flex: 1.3 }}
            />
          </>
        ) : (
          <Button label="Fermer" variant="outline" onPress={close} style={{ flex: 1 }} />
        )
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <MemberAvatar member={member} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[typography.label, { color: theme.foreground.white }]}>
            {member.isOwner ? "Vous · propriétaire du salon" : "Membre de l'équipe"}
          </Text>
          <Text style={[typography.caption, { color: theme.foreground.gray }]}>{weekSummary(stored)}</Text>
        </View>
      </View>

      {/* ── Bookings ───────────────────────────────────────────────────── */}
      <View style={{ gap: spacing.sm }}>
        <Group title="Rendez-vous">
          <RowShell
            icon="calendar-account-outline"
            label={member.isOwner ? "Je prends des rendez-vous" : "Prend des rendez-vous"}
            value={takesBookings ? "Réservable par les clients" : "Jamais réservé par les clients"}
            isLast
            right={
              <Switch
                value={takesBookings}
                onValueChange={toggleBookings}
                disabled={pendingBookings !== null}
                accessibilityLabel={member.isOwner ? "Je prends des rendez-vous" : "Prend des rendez-vous"}
                trackColor={{ false: theme.surface.sunken, true: theme.primary.main }}
                thumbColor={takesBookings ? theme.primary.on : theme.foreground.gray}
              />
            }
          />
        </Group>
        <Text style={[typography.caption, { color: theme.foreground.gray }]}>
          {takesBookings
            ? "Les réservations des clients peuvent lui être attribuées, selon ses horaires et ses congés."
            : "Les réservations des clients ne lui sont jamais attribuées. Vous pouvez toujours lui en confier une depuis l'agenda."}
        </Text>
      </View>

      {/* ── Week ───────────────────────────────────────────────────────── */}
      <View style={{ gap: spacing.md }}>
        <Text style={[typography.overline, { color: theme.foreground.gray }]}>HORAIRES</Text>
        <SegmentedControl<HoursMode>
          options={[
            { value: "salon", label: "Horaires du salon" },
            { value: "custom", label: "Horaires personnalisés" },
          ]}
          value={mode}
          onChange={setMode}
        />
        {mode === "salon" ? (
          <Text style={[typography.caption, { color: theme.foreground.gray }]}>
            {"Suit les heures d'ouverture du salon" +
              (salonOpen ? " (" + weekSummary(availability).toLowerCase() + ")" : "") +
              ", et leurs changements."}
          </Text>
        ) : (
          <>
            <Text style={[typography.caption, { color: theme.foreground.gray }]}>
              Un rendez-vous doit tenir à la fois dans les horaires du salon et dans les siens.
            </Text>
            {draft.map((day, index) => (
              <AvailabilityRow
                key={day.weekday}
                day={day}
                onChange={(next) =>
                  setDraft((current) => current.map((item, i) => (i === index ? next : item)))
                }
              />
            ))}
          </>
        )}
      </View>

      {/* ── Congés ─────────────────────────────────────────────────────── */}
      <Group title="Congés">
        <Row
          icon="calendar-remove-outline"
          label={member.isOwner ? "Mes congés" : "Ses congés"}
          value={
            daysOffCount === 0 ? "Aucun congé prévu" : daysOffCount > 1 ? daysOffCount + " à venir" : "1 à venir"
          }
          onPress={() => onOpenClosures(member)}
          isLast
        />
      </Group>

      {error ? <Text style={[typography.bodySmall, { color: theme.danger }]}>{error}</Text> : null}

      {member.isOwner ? null : (
        <Button
          label="Retirer de l'équipe"
          variant="outline"
          background={theme.danger}
          color={theme.danger}
          onPress={confirmRemove}
          loading={removing}
        />
      )}
    </BottomSheet>
  );
}
