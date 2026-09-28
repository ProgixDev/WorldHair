import React, { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { usePro } from "../../contexts/ProContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { Attendance, ProAppointment } from "../../features/pro/types";
import { proErrorMessage } from "../../services/pro";
import { formatDuration, formatPrice, relativeDay, timeOfDay } from "../../utils/date";
import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { SlotPicker } from "./SlotPicker";

const STATUS_LABELS: Record<ProAppointment["status"], string> = {
  pending: "En attente de votre réponse",
  confirmed: "Confirmé",
  done: "Terminé",
  cancelled: "Annulé",
  refused: "Refusé",
};

/**
 * One booking, everything the coiffeur can do with it: accept or refuse a
 * request, move or cancel an accepted appointment, and once it has started,
 * mark it attended or missed. Moving picks from the server's own slot grid.
 */
export function AppointmentSheet({
  appointment,
  visible,
  onClose,
}: {
  appointment: ProAppointment | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const {
    profile,
    availability,
    timeOff,
    setAppointmentStatus,
    moveAppointment,
    setAttendance,
  } = usePro();
  const [mode, setMode] = useState<"details" | "move">("details");
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [gridVersion, setGridVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode("details");
    setMoveTo(null);
    setError(null);
  }, [appointment?.id, visible]);

  if (!appointment) {
    return <BottomSheet visible={false} title="" onClose={onClose}>{null}</BottomSheet>;
  }

  const start = new Date(appointment.startsAt);
  const started = start.getTime() <= Date.now();
  const isPending = appointment.status === "pending";
  const canMoveOrCancel = appointment.status === "confirmed" && !started;
  const canMark =
    (appointment.status === "confirmed" || appointment.status === "done") && started;
  const lines =
    appointment.services.length > 0
      ? appointment.services
      : [{ serviceId: appointment.serviceId, name: "Prestation", price: appointment.price, durationMin: appointment.durationMin }];

  const run = async (action: () => Promise<void>, closeAfter = true, onFailure?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (closeAfter) onClose();
    } catch (err) {
      setError(proErrorMessage(err));
      onFailure?.();
    } finally {
      setBusy(false);
    }
  };

  const confirmCancel = () =>
    Alert.alert(
      "Annuler ce rendez-vous ?",
      appointment.clientName + " sera prévenu de l'annulation.",
      [
        { text: "Garder", style: "cancel" },
        {
          text: "Annuler le RDV",
          style: "destructive",
          onPress: () => void run(() => setAppointmentStatus(appointment.id, "cancelled")),
        },
      ],
    );

  const mark = (attendance: Attendance) =>
    void run(() => setAttendance(appointment.id, attendance), false);

  const footer =
    mode === "move" ? (
      <>
        <Button label="Retour" variant="outline" onPress={() => setMode("details")} style={{ flex: 1 }} />
        <Button
          label="Déplacer ici"
          onPress={() =>
            moveTo &&
            void run(() => moveAppointment(appointment.id, moveTo), true, () => {
              // Someone may have booked that time meanwhile: show the grid as it is now.
              setMoveTo(null);
              setGridVersion((version) => version + 1);
            })
          }
          disabled={!moveTo}
          loading={busy}
          background={theme.primary.main}
          color={theme.primary.on}
          style={{ flex: 1.3 }}
        />
      </>
    ) : isPending && !started ? (
      <>
        <Button
          label="Refuser"
          variant="outline"
          background={theme.danger}
          color={theme.danger}
          onPress={() => void run(() => setAppointmentStatus(appointment.id, "refused"))}
          disabled={busy}
          style={{ flex: 1 }}
        />
        <Button
          label="Accepter"
          onPress={() => void run(() => setAppointmentStatus(appointment.id, "confirmed"))}
          loading={busy}
          background={theme.primary.main}
          color={theme.primary.on}
          style={{ flex: 1.3 }}
        />
      </>
    ) : canMoveOrCancel ? (
      <>
        <Button
          label="Annuler"
          variant="outline"
          background={theme.danger}
          color={theme.danger}
          onPress={confirmCancel}
          disabled={busy}
          style={{ flex: 1 }}
        />
        <Button
          label="Déplacer"
          onPress={() => setMode("move")}
          background={theme.primary.main}
          color={theme.primary.on}
          style={{ flex: 1.3 }}
        />
      </>
    ) : undefined;

  return (
    <BottomSheet
      visible={visible}
      title={mode === "move" ? "Déplacer le rendez-vous" : appointment.clientName}
      onClose={onClose}
      footer={footer}
    >
      {mode === "move" && profile ? (
        <View style={{ gap: spacing.md }}>
          <Text style={[typography.bodySmall, { color: theme.foreground.gray }]}>
            {appointment.clientName +
              " sera prévenu du nouvel horaire. Actuellement : " +
              relativeDay(start).toLowerCase() +
              " à " +
              timeOfDay(start) +
              "."}
          </Text>
          <SlotPicker
            salonId={profile.salonId}
            appointmentId={appointment.id}
            availability={availability}
            timeOff={timeOff}
            selected={moveTo}
            onSelect={setMoveTo}
            version={gridVersion}
          />
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <Text style={[typography.label, { color: theme.foreground.white }]}>
            {relativeDay(start) +
              " · " +
              timeOfDay(start) +
              " · " +
              formatDuration(appointment.durationMin)}
          </Text>
          <Text style={[typography.caption, { color: theme.foreground.gray }]}>
            {STATUS_LABELS[appointment.status] +
              (appointment.attendance === "attended"
                ? " · honoré"
                : appointment.attendance === "no_show"
                  ? " · absent"
                  : "")}
          </Text>

          <View
            style={{
              gap: spacing.sm,
              padding: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: theme.surface.base,
            }}
          >
            {lines.map((line, index) => (
              <View
                key={index}
                style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}
              >
                <Text style={[typography.bodySmall, { color: theme.foreground.white, flex: 1 }]}>
                  {line.name + " · " + formatDuration(line.durationMin)}
                </Text>
                <Text style={[typography.bodySmall, { color: theme.foreground.gray }]}>
                  {formatPrice(line.price)}
                </Text>
              </View>
            ))}
            {lines.length > 1 ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[typography.label, { color: theme.foreground.white }]}>Total</Text>
                <Text style={[typography.label, { color: theme.accent.warm }]}>
                  {formatPrice(appointment.price)}
                </Text>
              </View>
            ) : null}
          </View>

          {appointment.note ? (
            <Text style={[typography.caption, { color: theme.foreground.gray }]}>
              {"« " + appointment.note + " »"}
            </Text>
          ) : null}

          {canMark ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.overline, { color: theme.foreground.gray }]}>
                LE CLIENT EST-IL VENU ?
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Chip
                  label="Honoré"
                  icon="check-circle-outline"
                  selected={appointment.attendance === "attended"}
                  onPress={() => mark("attended")}
                />
                <Chip
                  label="Absent"
                  icon="account-cancel-outline"
                  selected={appointment.attendance === "no_show"}
                  onPress={() => mark("no_show")}
                />
              </View>
              <Text style={[typography.caption, { color: theme.foreground.gray }]}>
                Un client absent ne peut pas laisser d&apos;avis sur ce rendez-vous.
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {error ? (
        <Text style={[typography.bodySmall, { color: theme.danger }]}>{error}</Text>
      ) : null}
    </BottomSheet>
  );
}
