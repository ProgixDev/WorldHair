import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../../components/ui/Button";
import { elevation, TAB_BAR_CLEARANCE } from "../../constants/elevation";
import { useResponsive } from "../../constants/responsive";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { usePro } from "../../contexts/ProContext";
import { useTheme } from "../../contexts/ThemeContext";
import { euros, payoutLine, waitingPayout } from "../../features/pro/payouts";
import type { PayoutStatus, ProAppointment } from "../../features/pro/types";
import {
  createPayoutDashboardLink,
  createPayoutOnboardingLink,
  proErrorMessage,
} from "../../services/pro";
import { fullDate } from "../../utils/date";

/** Where Stripe's onboarding hands back to the app (via the website's /connect/retour page). */
const RETURN_URL = "worldhair://pro/payments";

const STATUS_COPY: Record<PayoutStatus["state"], { title: string; detail: string; action: string | null }> = {
  none: {
    title: "Réservations en ligne fermées",
    detail:
      "Configurez vos paiements pour que vos clients réservent et paient dans l'application. Stripe vérifie votre identité et votre RIB sur sa propre page.",
    action: "Configurer mes paiements",
  },
  incomplete: {
    title: "Configuration à terminer",
    detail: "Stripe attend encore quelques informations avant d'ouvrir vos réservations en ligne.",
    action: "Reprendre la configuration",
  },
  ready: {
    title: "Paiements actifs",
    detail: "Vos clients réservent et paient dans l'application. Vous recevez chaque montant, moins la commission WorldHair, 24 h après le rendez-vous.",
    action: null,
  },
  exempt: {
    title: "Salon de démonstration",
    detail:
      "Les réservations en ligne sont ouvertes sans compte Stripe pour tester : l'argent reste chez WorldHair. Configurez vos paiements pour le recevoir.",
    action: "Configurer mes paiements",
  },
};

/**
 * "Paiements": where the salon gets paid (Stripe Connect Express) and what
 * each booking paid, cost in commission and brought in. Setting up happens
 * on Stripe's own pages, opened in the browser — never here.
 */
export default function ProPaymentsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();
  const { payoutStatus, appointments, refreshPayoutStatus, isLoading } = usePro();
  const [opening, setOpening] = useState<"onboarding" | "dashboard" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paid = useMemo(
    () =>
      appointments
        .filter((appointment): appointment is ProAppointment & { payment: NonNullable<ProAppointment["payment"]> } =>
          Boolean(appointment.payment),
        )
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    [appointments],
  );

  const open = async (which: "onboarding" | "dashboard") => {
    setError(null);
    setOpening(which);
    try {
      if (which === "onboarding") {
        await WebBrowser.openAuthSessionAsync(await createPayoutOnboardingLink(), RETURN_URL);
        await refreshPayoutStatus();
      } else {
        await WebBrowser.openBrowserAsync(await createPayoutDashboardLink());
      }
    } catch (err) {
      setError(proErrorMessage(err));
    } finally {
      setOpening(null);
    }
  };

  const copy = payoutStatus ? STATUS_COPY[payoutStatus.state] : null;
  // Paid by clients, not sendable until the salon's payouts are active.
  const waiting = payoutStatus && payoutStatus.state !== "ready" ? waitingPayout(appointments) : 0;
  const tone = payoutStatus?.state === "ready" ? theme.success : payoutStatus?.state === "exempt" ? theme.primary.main : theme.accent.warm;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background.dark }}
      contentContainerStyle={{
        paddingHorizontal: gutter,
        paddingTop: insets.top + spacing.md,
        paddingBottom: Math.max(insets.bottom, spacing.md) + TAB_BAR_CLEARANCE,
        gap: spacing.xl,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Pressable
          onPress={() => router.navigate("/pro/account" as never)}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={8}
        >
          <MaterialCommunityIcons name="chevron-left" size={26} color={theme.foreground.white} />
        </Pressable>
        <Text style={[typography.display, { color: theme.foreground.white }]} accessibilityRole="header">
          Paiements
        </Text>
      </View>

      {isLoading || !copy ? (
        <ActivityIndicator color={theme.primary.main} />
      ) : (
        <View
          style={[
            {
              padding: spacing.lg,
              borderRadius: radius.xl,
              backgroundColor: theme.surface.raised,
              borderWidth: 1.5,
              borderColor: tone,
              gap: spacing.md,
            },
            elevation(1, theme.shadow),
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <MaterialCommunityIcons
              name={payoutStatus?.state === "ready" ? "bank-check" : "bank-outline"}
              size={22}
              color={tone}
            />
            <Text style={[typography.h2, { color: theme.foreground.white, flex: 1 }]}>{copy.title}</Text>
          </View>
          <Text style={[typography.bodySmall, { color: theme.foreground.gray }]}>{copy.detail}</Text>
          {waiting > 0 ? (
            <Text style={[typography.label, { color: theme.foreground.white }]}>
              {euros(waiting) + " payés par vos clients vous attendent. Ils vous seront versés dès vos paiements configurés."}
            </Text>
          ) : null}
          {copy.action ? (
            <Button
              label={copy.action}
              onPress={() => void open("onboarding")}
              loading={opening === "onboarding"}
              background={theme.primary.main}
              color={theme.primary.on}
            />
          ) : null}
          {payoutStatus?.canOpenDashboard ? (
            <Button
              label="Voir mes versements sur Stripe"
              variant="outline"
              onPress={() => void open("dashboard")}
              loading={opening === "dashboard"}
            />
          ) : null}
          {error ? <Text style={[typography.caption, { color: theme.danger }]}>{error}</Text> : null}
        </View>
      )}

      <View style={{ gap: spacing.md }}>
        <Text style={[typography.overline, { color: theme.foreground.gray }]}>RÉSERVATIONS PAYÉES</Text>
        {paid.length === 0 ? (
          <Text style={[typography.bodySmall, { color: theme.foreground.gray }]}>
            Aucune réservation payée dans l&apos;application pour l&apos;instant.
          </Text>
        ) : (
          paid.map((appointment) => {
            const { payment } = appointment;
            const payout = payoutLine(appointment, payoutStatus?.state);
            return (
              <View
                key={appointment.id}
                style={{
                  padding: spacing.lg,
                  borderRadius: radius.lg,
                  backgroundColor: theme.surface.raised,
                  borderWidth: 1,
                  borderColor: theme.divider,
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
                  <Text style={[typography.label, { color: theme.foreground.white, flex: 1 }]} numberOfLines={1}>
                    {appointment.clientName}
                  </Text>
                  <Text style={[typography.label, { color: theme.foreground.white }]}>{euros(payment.amount)}</Text>
                </View>
                <Text style={[typography.caption, { color: theme.foreground.gray }]}>
                  {fullDate(new Date(appointment.startsAt))}
                </Text>
                {payment.refundedAmount > 0 ? (
                  <Text style={[typography.caption, { color: theme.danger }]}>
                    {"Remboursé " + euros(payment.refundedAmount)}
                  </Text>
                ) : null}
                {payout ? (
                  <Text style={[typography.caption, { color: theme.foreground.gray }]}>{payout}</Text>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
