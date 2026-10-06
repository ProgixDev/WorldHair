import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import { codeRefreshDelayMs, codeValidityLabel, presenceLink } from "../../features/pro/presence";
import type { ProAppointment } from "../../features/pro/types";
import {
  getPresenceStatus,
  isAlreadyConfirmed,
  issueCompletionCode,
  completionCodeErrorMessage,
  type CompletionCode,
} from "../../services/completionCode";
import { timeOfDay } from "../../utils/date";
import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/Button";
import { QrCode } from "../ui/QrCode";

/** How often the sheet asks whether the client has scanned. */
const POLL_MS = 4_000;
/** A renewal that failed while the code on screen still works is tried again this soon. */
const RETRY_MS = 5_000;
const QR_SIZE = 220;

/**
 * « Afficher le code de fin » (TODO.md): a QR code the client scans with
 * their phone's own camera once the service is done. Proof of presence for
 * verified reviews and disputes — it changes nothing about when the salon is
 * paid, and the manual « Honoré » / « Absent » stay.
 *
 * Codes live five minutes and each request replaces the last, so the sheet
 * asks for a new one a minute before the current one runs out and keeps
 * showing a valid one. It checks every few seconds whether the client has
 * confirmed, then says so and tells the caller (`onConfirmed`) to refresh
 * its list. Everything it started stops on close or unmount, and an answer
 * that arrives late is ignored.
 */
export function CompletionCodeSheet({
  appointment,
  visible,
  onClose,
  onConfirmed,
}: {
  appointment: Pick<ProAppointment, "id" | "clientName"> | null;
  visible: boolean;
  onClose: () => void;
  /** The client confirmed: the caller refreshes its bookings so the card reads « Confirmé par le client ». */
  onConfirmed?: () => void;
}) {
  const { theme } = useTheme();
  const appointmentId = appointment?.id ?? null;

  const [code, setCode] = useState<CompletionCode | null>(null);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Bumped by « Réessayer »: starts the whole exchange again. */
  const [attempt, setAttempt] = useState(0);

  // Held in a ref so a parent passing a new function each render doesn't restart the exchange.
  const onConfirmedRef = useRef(onConfirmed);
  useEffect(() => {
    onConfirmedRef.current = onConfirmed;
  }, [onConfirmed]);

  useEffect(() => {
    if (!visible || !appointmentId) return;

    // Cleared on open, not on close: the last content stays put while the sheet slides away.
    setCode(null);
    setConfirmedAt(null);
    setError(null);

    let stopped = false;
    let renewTimer: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let polling = false;
    let current: CompletionCode | null = null;

    const stop = () => {
      stopped = true;
      clearTimeout(renewTimer);
      clearInterval(pollTimer);
    };

    const checkStatus = async () => {
      // One question at a time: a slow answer never piles up behind the next tick.
      if (polling || stopped) return;
      polling = true;
      try {
        const { confirmedByClientAt } = await getPresenceStatus(appointmentId);
        if (stopped || !confirmedByClientAt) return;
        stop();
        setConfirmedAt(confirmedByClientAt);
        onConfirmedRef.current?.();
      } catch {
        // A missed check is made again a few seconds later.
      } finally {
        polling = false;
      }
    };

    const renew = async () => {
      try {
        const next = await issueCompletionCode(appointmentId);
        if (stopped) return;
        current = next;
        setCode(next);
        setError(null);
        renewTimer = setTimeout(() => void renew(), codeRefreshDelayMs(next.expiresAt));
      } catch (err) {
        if (stopped) return;
        if (isAlreadyConfirmed(err)) {
          // The client scanned between two checks: let the next answer say so.
          await checkStatus();
          if (!stopped) {
            clearInterval(pollTimer);
            setError(completionCodeErrorMessage(err));
          }
          return;
        }
        const remaining = current ? new Date(current.expiresAt).getTime() - Date.now() : 0;
        if (remaining > 0) {
          // The code on screen still works: keep it, try again before it runs out.
          renewTimer = setTimeout(() => void renew(), Math.min(RETRY_MS, remaining));
          return;
        }
        clearInterval(pollTimer);
        setCode(null);
        setError(completionCodeErrorMessage(err));
      }
    };

    void renew();
    pollTimer = setInterval(() => void checkStatus(), POLL_MS);
    return stop;
  }, [visible, appointmentId, attempt]);

  const link = code ? presenceLink(code.code) : null;
  const name = appointment?.clientName ?? "le client";

  const footer = confirmedAt ? (
    <Button
      label="Fermer"
      onPress={onClose}
      background={theme.primary.main}
      color={theme.primary.on}
      style={{ flex: 1 }}
    />
  ) : error ? (
    <>
      <Button label="Fermer" variant="outline" onPress={onClose} style={{ flex: 1 }} />
      <Button
        label="Réessayer"
        icon="refresh"
        onPress={() => setAttempt((value) => value + 1)}
        background={theme.primary.main}
        color={theme.primary.on}
        style={{ flex: 1.3 }}
      />
    </>
  ) : (
    <Button label="Fermer" variant="outline" onPress={onClose} style={{ flex: 1 }} />
  );

  return (
    <BottomSheet visible={visible} title="Code de fin" onClose={onClose} footer={footer}>
      {confirmedAt ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            alignItems: "center",
            gap: spacing.md,
            paddingVertical: spacing.xl,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.lg,
            backgroundColor: theme.surface.sunken,
            borderWidth: 1,
            borderColor: theme.divider,
          }}
        >
          <MaterialCommunityIcons name="check-circle" size={64} color={theme.success} />
          <Text style={[typography.h2, { color: theme.foreground.white, textAlign: "center" }]}>
            {"Confirmé par " + name}
          </Text>
          <Text style={[typography.bodySmall, { color: theme.foreground.gray, textAlign: "center" }]}>
            {"Le client a confirmé la prestation à " + timeOfDay(new Date(confirmedAt)) + "."}
          </Text>
        </View>
      ) : error ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            alignItems: "center",
            gap: spacing.md,
            paddingVertical: spacing.xl,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.lg,
            backgroundColor: theme.surface.sunken,
            borderWidth: 1,
            borderColor: theme.divider,
          }}
        >
          <MaterialCommunityIcons name="alert-circle-outline" size={40} color={theme.danger} />
          <Text style={[typography.bodySmall, { color: theme.danger, textAlign: "center" }]}>{error}</Text>
        </View>
      ) : code && link ? (
        <View
          style={{
            alignItems: "center",
            gap: spacing.md,
            paddingVertical: spacing.xl,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.lg,
            backgroundColor: theme.surface.sunken,
            borderWidth: 1,
            borderColor: theme.divider,
          }}
        >
          <QrCode value={link} size={QR_SIZE} />
          <Text style={[typography.bodySmall, { color: theme.foreground.white, textAlign: "center" }]}>
            Faites scanner ce code par votre client avec l&apos;appareil photo de son téléphone.
          </Text>
          <Validity expiresAt={code.expiresAt} />
        </View>
      ) : code ? (
        // A build without the website's address (EXPO_PUBLIC_WEB_URL): the QR has no link to hold.
        <Text style={[typography.bodySmall, { color: theme.danger, textAlign: "center" }]}>
          Le QR code ne peut pas être affiché : l&apos;adresse du site WorldHair n&apos;est pas configurée dans cette
          version de l&apos;application.
        </Text>
      ) : (
        <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.xxl }}>
          <ActivityIndicator color={theme.primary.main} />
          <Text style={[typography.bodySmall, { color: theme.foreground.gray }]}>Préparation du code…</Text>
        </View>
      )}
    </BottomSheet>
  );
}

/** « Valable encore 4 min » — its own clock, so the code's QR isn't redrawn at every tick. */
function Validity({ expiresAt }: { expiresAt: string }) {
  const { theme } = useTheme();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <Text style={[typography.label, { color: theme.primary.main }]}>{codeValidityLabel(expiresAt, now)}</Text>
      <Text style={[typography.caption, { color: theme.foreground.gray, textAlign: "center" }]}>
        Il se renouvelle tout seul : gardez cet écran ouvert.
      </Text>
    </View>
  );
}
