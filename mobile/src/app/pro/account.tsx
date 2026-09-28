import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../../components/ui/Button";
import { Group, Row, RowShell } from "../../components/ui/SettingsList";
import { elevation, TAB_BAR_CLEARANCE } from "../../constants/elevation";
import { useResponsive } from "../../constants/responsive";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useAuth } from "../../contexts/AuthContext";
import { usePro } from "../../contexts/ProContext";
import { useTheme } from "../../contexts/ThemeContext";
import { ROUTES } from "../../features/auth/routing";
import { countBookingsAfterEnd, describeSubscription } from "../../features/pro/subscription";
import type { Subscription } from "../../features/pro/types";
import { fullDate } from "../../utils/date";
import { MyDataGroups } from "../../components/account/MyDataGroups";

const BENEFITS = [
  "Fiche visible dans la recherche et sur la carte",
  "Réservations en ligne illimitées",
  "Agenda, statistiques et gestion des avis",
  "Notifications de nouveaux rendez-vous",
];

/** The next date that matters, and how to call it. */
function keyDate(subscription: Subscription): { label: string; value: string } | null {
  const on = (iso: string | null) => (iso ? fullDate(new Date(iso)) : null);
  const value =
    subscription.state === "trialing"
      ? on(subscription.trialEndsAt)
      : subscription.state === "active" && !subscription.offered
        ? on(subscription.currentPeriodEnd)
        : on(subscription.endsAt);
  if (!value) return null;
  return {
    label:
      subscription.state === "trialing"
        ? "Premier prélèvement"
        : subscription.state === "active" && !subscription.offered
          ? "Prochain prélèvement"
          : "Fiche visible jusqu'au",
    value,
  };
}

/**
 * Subscription-first account tab: where the subscription stands, then
 * account rows. Read-only — subscribing, the card, invoices and cancelling
 * all happen on the website, through Stripe; nothing is sold in the app.
 */
export default function ProAccount() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();
  const { session, signOut } = useAuth();
  const { profile, subscription, appointments, payoutStatus, isLoading, refreshSubscription } = usePro();

  const [refreshing, setRefreshing] = useState(false);

  if (isLoading || !subscription)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background.dark,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={theme.primary.main} />
      </View>
    );

  const summary = describeSubscription(subscription, new Date(), {
    bookingsAfterEnd: countBookingsAfterEnd(subscription, appointments),
  });
  const toneColor =
    summary.tone === "danger"
      ? theme.danger
      : summary.tone === "warning"
        ? theme.accent.warm
        : theme.primary.main;
  const date = keyDate(subscription);
  const hasPlan = subscription.state !== "none" && subscription.state !== "expired" && !subscription.offered;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await refreshSubscription();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignOut = () =>
    Alert.alert("Se déconnecter ?", "Vous devrez saisir vos identifiants.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Se déconnecter",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace(ROUTES.signIn as never);
        },
      },
    ]);

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
      <Text
        style={[typography.display, { color: theme.foreground.white }]}
        accessibilityRole="header"
      >
        Abonnement
      </Text>

      {/* ── Status ───────────────────────────────────────────────────── */}
      <View
        style={[
          {
            padding: spacing.lg,
            borderRadius: radius.xl,
            backgroundColor: theme.surface.raised,
            borderWidth: 1.5,
            borderColor: toneColor,
            gap: spacing.sm,
          },
          elevation(1, theme.shadow),
        ]}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <MaterialCommunityIcons
            name={
              summary.tone === "ok"
                ? subscription.state === "trialing"
                  ? "gift-outline"
                  : "crown-outline"
                : "alert-circle-outline"
            }
            size={20}
            color={toneColor}
          />
          <Text style={[typography.h2, { color: theme.foreground.white, flex: 1 }]}>
            {summary.title}
          </Text>
        </View>
        <Text style={[typography.bodySmall, { color: theme.foreground.gray }]}>
          {summary.detail}
        </Text>
      </View>

      {/* ── Details ──────────────────────────────────────────────────── */}
      <Group title="Abonnement">
        <RowShell
          icon="eye-outline"
          label="Fiche visible par les clients"
          value={subscription.listed ? "Oui" : "Non"}
        />
        {hasPlan ? (
          <RowShell
            icon="calendar-sync-outline"
            label="Formule"
            value={subscription.plan === "yearly" ? "Annuelle" : "Mensuelle"}
          />
        ) : null}
        {date ? (
          <RowShell icon="calendar-clock-outline" label={date.label} value={date.value} />
        ) : null}
        <RowShell
          icon="storefront-outline"
          label="Salon"
          value={profile?.name ?? "—"}
          isLast
        />
      </Group>
      <View style={{ gap: spacing.md }}>
        <Text style={[typography.caption, { color: theme.foreground.gray }]}>
          Aucun paiement ne se fait dans l&apos;application.
        </Text>
        <Button
          label="Actualiser le statut"
          variant="outline"
          onPress={() => void refresh()}
          loading={refreshing}
        />
      </View>

      {/* ── Benefits ─────────────────────────────────────────────────── */}
      <View style={{ gap: spacing.md }}>
        <Text style={[typography.overline, { color: theme.foreground.gray }]}>
          INCLUS DANS L&apos;ABONNEMENT
        </Text>
        {BENEFITS.map((benefit) => (
          <View
            key={benefit}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <MaterialCommunityIcons
              name="check"
              size={17}
              color={theme.success}
            />
            <Text
              style={[
                typography.bodySmall,
                { color: theme.foreground.gray, flex: 1 },
              ]}
            >
              {benefit}
            </Text>
          </View>
        ))}
      </View>

      {/* ── Payments (Stripe Connect) ─────────────────────────────────── */}
      <Group title="Encaissements">
        <Row
          icon="bank-outline"
          label="Paiements"
          value={
            payoutStatus?.state === "ready"
              ? "Actifs"
              : payoutStatus?.state === "exempt"
                ? "Démonstration"
                : payoutStatus?.state === "incomplete"
                  ? "À terminer"
                  : "À configurer"
          }
          onPress={() => router.push("/pro/payments" as never)}
          isLast
        />
      </Group>

      {/* ── Preferences ──────────────────────────────────────────────── */}
      <Group title="Préférences">
        <Row
          icon="palette-outline"
          label="Apparence"
          value="Clair, sombre ou système"
          onPress={() => router.push("/screens/Themes" as never)}
          isLast
        />
      </Group>

      {/* ── Account ──────────────────────────────────────────────────── */}
      <Group title="Compte">
        <RowShell
          icon="email-outline"
          label="Email"
          value={session?.email ?? "—"}
        />
        <RowShell
          icon="account-outline"
          label="Coiffeur"
          value={profile?.stylist ?? "—"}
        />
        <Row
          icon="logout"
          label="Se déconnecter"
          tone="danger"
          onPress={handleSignOut}
          isLast
        />
      </Group>

      {/* ── My data, legal pages (TODO.md Phase 8) ─────────────────────── */}
      <MyDataGroups />
    </ScrollView>
  );
}
