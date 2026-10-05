import React, { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { usePro } from "../../contexts/ProContext";
import { useTheme } from "../../contexts/ThemeContext";
import { cancellationNote, cancelledLabel } from "../../features/appointments/cancellation";
import type { Attendance, ProAppointment } from "../../features/pro/types";
import { proErrorMessage } from "../../services/pro";
import { formatDuration, formatPrice, fullDate, relativeDay, timeOfDay } from "../../utils/date";
import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { TextField } from "../ui/TextField";
import { SlotPicker } from "./SlotPicker";
import { StaffPicker } from "./StaffPicker";
import { personOf } from "../../features/pro/staffPick";

function euros(amount: number): string {
  return (Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(".", ",")) + " €";
}

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
 * With a team (TODO.md Phase 3), accepting means choosing who does it
 * (« Qui s'en occupe ? »), and an accepted booking can go to someone else.
 */
export function AppointmentSheet({
  appointment,
  visible,
  onClose,
  startWith = "details",
}: {
  appointment: ProAppointment | null;
  visible: boolean;
  onClose: () => void;
  /** "accept": straight to « Qui s'en occupe ? » (the agenda's « Accepter »). */
  startWith?: "details" | "accept";
}) {
  const { theme } = useTheme();
  const {
    profile,
    availability,
    timeOff,
    setAppointmentStatus,
    moveAppointment,
    assignAppointment,
    setAttendance,
    refundAppointment,
    team,
  } = usePro();
  const [mode, setMode] = useState<"details" | "move" | "accept" | "assign">("details");
  const [pickedStaff, setPickedStaff] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [gridVersion, setGridVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState("");

  // A salon of one has nobody to choose between: accepting stays one tap.
  const hasTeam = team.length > 1;

  useEffect(() => {
    setMode(startWith === "accept" && hasTeam ? "accept" : "details");
    setMoveTo(null);
    setPickedStaff(null);
    setError(null);
    setRefundAmount("");
  }, [appointment?.id, visible, startWith, hasTeam]);

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

  const payment = appointment.payment;
  const refundable = payment ? Math.round((payment.amount - payment.refundedAmount) * 100) / 100 : 0;
  // Until the salon's share has left (a day after the appointment), the coiffeur can give money back.
  const canRefund =
    Boolean(payment) &&
    !payment?.paidOutAt &&
    refundable > 0 &&
    (appointment.status === "confirmed" || appointment.status === "done");

  const confirmRefund = () => {
    const typed = refundAmount.trim().replace(",", ".");
    const amount = typed === "" ? refundable : Number(typed);
    if (!Number.isFinite(amount) || amount <= 0 || amount > refundable) {
      setError("Montant à rembourser entre 0,01 € et " + euros(refundable) + ".");
      return;
    }
    Alert.alert(
      "Rembourser " + euros(amount) + " ?",
      appointment.clientName + " sera remboursé sur sa carte, sous quelques jours.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Rembourser",
          style: "destructive",
          onPress: () =>
            void run(async () => {
              await refundAppointment(appointment.id, amount === refundable ? undefined : amount);
              setRefundAmount("");
            }, false),
        },
      ],
    );
  };

  const accept = () =>
    hasTeam
      ? setMode("accept")
      : void run(() => setAppointmentStatus(appointment.id, "confirmed"));
  const pickedName = team.find((member) => member.id === pickedStaff);

  const footer =
    mode === "accept" || mode === "assign" ? (
      <>
        <Button label="Retour" variant="outline" onPress={() => setMode("details")} style={{ flex: 1 }} />
        <Button
          label={
            mode === "accept"
              ? pickedName
                ? "Accepter avec " + (pickedName.isOwner ? "moi" : pickedName.firstName)
                : "Accepter"
              : "Confier"
          }
          onPress={() =>
            pickedStaff &&
            void run(() =>
              mode === "accept"
                ? setAppointmentStatus(appointment.id, "confirmed", pickedStaff)
                : assignAppointment(appointment.id, pickedStaff),
            )
          }
          disabled={!pickedStaff}
          loading={busy}
          background={theme.primary.main}
          color={theme.primary.on}
          style={{ flex: 1.3 }}
        />
      </>
    ) : mode === "move" ? (
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
          onPress={accept}
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
      title={
        mode === "move"
          ? "Déplacer le rendez-vous"
          : mode === "accept" || mode === "assign"
            ? "Qui s'en occupe ?"
            : appointment.clientName
      }
      onClose={onClose}
      footer={footer}
    >
      {mode === "accept" || mode === "assign" ? (
        <View style={{ gap: spacing.md }}>
          <Text style={[typography.bodySmall, { color: theme.foreground.gray }]}>
            {appointment.clientName +
              " · " +
              relativeDay(start).toLowerCase() +
              " à " +
              timeOfDay(start) +
              " · " +
              formatDuration(appointment.durationMin) +
              (mode === "assign" ? ". La personne choisie est prévenue." : ".")}
          </Text>
          <StaffPicker appointmentId={appointment.id} selected={pickedStaff} onSelect={setPickedStaff} />
        </View>
      ) : mode === "move" && profile ? (
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
            {(appointment.status === "cancelled"
              ? cancelledLabel(appointment.cancelledBy, "salon")
              : STATUS_LABELS[appointment.status]) +
              (appointment.attendance === "attended"
                ? " · honoré"
                : appointment.attendance === "no_show"
                  ? " · absent"
                  : "")}
          </Text>
          {cancellationNote(appointment) ? (
            <Text style={[typography.caption, { color: theme.danger }]}>{cancellationNote(appointment)}</Text>
          ) : null}

          {hasTeam ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Text style={[typography.bodySmall, { color: theme.foreground.white, flex: 1 }]}>
                {(isPending ? "Prévu avec " : "Avec ") + staffNameOf(appointment, team)}
              </Text>
              {canMoveOrCancel ? (
                <Button label="Changer" variant="outline" onPress={() => setMode("assign")} disabled={busy} />
              ) : null}
            </View>
          ) : null}

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

          {payment ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.overline, { color: theme.foreground.gray }]}>PAIEMENT</Text>
              <Text style={[typography.bodySmall, { color: theme.foreground.white }]}>
                {"Payé " +
                  euros(payment.amount) +
                  (payment.refundedAmount > 0 ? " · remboursé " + euros(payment.refundedAmount) : "")}
              </Text>
              {refundable > 0 ? (
                <Text style={[typography.caption, { color: theme.foreground.gray }]}>
                  {(payment.paidOutAt
                    ? "Versé " + euros(payment.payoutAmount) + " le " + fullDate(new Date(payment.paidOutAt))
                    : "Votre part : " + euros(payment.payoutAmount) + ", versée 24 h après le rendez-vous") +
                    " · commission " +
                    euros(payment.commissionAmount)}
                </Text>
              ) : null}
              {canRefund ? (
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <TextField
                      label="Rembourser (€)"
                      value={refundAmount}
                      onChangeText={setRefundAmount}
                      placeholder={"Tout : " + euros(refundable)}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <Button
                    label="Rembourser"
                    variant="outline"
                    background={theme.danger}
                    color={theme.danger}
                    onPress={confirmRefund}
                    disabled={busy}
                  />
                </View>
              ) : null}
            </View>
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

/** Who does it, as the salon reads it: « moi » for the owner (a booking without a person is his), « — » once that person has left. */
function staffNameOf(
  appointment: ProAppointment,
  team: { id: string; firstName: string; isOwner: boolean }[],
): string {
  const ownerId = team.find((person) => person.isOwner)?.id ?? null;
  const member = team.find((person) => person.id === personOf(appointment, ownerId));
  if (member) return member.isOwner ? "moi" : member.firstName;
  return appointment.staffName ?? "—";
}
