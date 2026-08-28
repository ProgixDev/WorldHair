import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
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
import { daysRemaining } from "../../features/pro/subscription";
import { PLANS, type PlanId } from "../../features/pro/types";
import { debugSetSubscriptionEnd, resetProWorkspace } from "../../services/pro";
import { formatAmount, fullDate } from "../../utils/date";

const BENEFITS = [
  "Fiche visible dans la recherche et sur la carte",
  "Réservations en ligne illimitées",
  "Agenda, statistiques et gestion des avis",
  "Notifications de nouveaux rendez-vous",
];

/**
 * Subscription-first account tab: the two plans as cards, then billing and
 * account rows. The plan is the reason this screen exists, so it leads.
 */
export default function ProAccount() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();
  const { session, signOut } = useAuth();
  const {
    profile,
    subscription,
    isLoading,
    changePlan,
    cancelSubscription,
    reactivateSubscription,
    refresh,
  } = usePro();

  const [busy, setBusy] = useState<PlanId | "cancel" | null>(null);

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

  const trialDaysLeft = subscription.trialEndsAt
    ? Math.max(0, daysRemaining(subscription))
    : null;

  const select = async (plan: PlanId) => {
    if (plan === subscription.plan && subscription.status !== "cancelled")
      return;
    setBusy(plan);
    try {
      await changePlan(plan);
    } finally {
      setBusy(null);
    }
  };

  const confirmCancel = () =>
    Alert.alert(
      "Résilier l'abonnement ?",
      "Votre fiche restera visible jusqu'à la fin de la période déjà payée, puis sera masquée.",
      [
        { text: "Garder", style: "cancel" },
        {
          text: "Résilier",
          style: "destructive",
          onPress: async () => {
            setBusy("cancel");
            try {
              await cancelSubscription();
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );

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

  const handleResetWorkspace = () =>
    Alert.alert(
      "Réinitialiser l'espace pro ?",
      "Prestations, agenda, rendez-vous, réponses et abonnement de démo seront regénérés.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Réinitialiser",
          style: "destructive",
          onPress: async () => {
            await resetProWorkspace();
            await refresh();
          },
        },
      ],
    );

  const simulateSubscriptionEnd = async (
    daysFromNow: number,
    status: "trial" | "cancelled",
  ) => {
    await debugSetSubscriptionEnd(daysFromNow, status);
    await refresh();
  };

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
            borderColor:
              subscription.status === "cancelled"
                ? theme.danger
                : theme.primary.main,
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
              subscription.status === "cancelled"
                ? "alert-circle-outline"
                : subscription.status === "trial"
                  ? "gift-outline"
                  : "crown-outline"
            }
            size={20}
            color={
              subscription.status === "cancelled"
                ? theme.danger
                : theme.primary.main
            }
          />
          <Text style={[typography.h2, { color: theme.foreground.white }]}>
            {subscription.status === "trial"
              ? "Essai gratuit"
              : subscription.status === "cancelled"
                ? "Résilié"
                : "Abonnement actif"}
          </Text>
        </View>

        <Text style={[typography.bodySmall, { color: theme.foreground.gray }]}>
          {subscription.status === "trial"
            ? "Premier mois offert — " +
              trialDaysLeft +
              " jours restants. Le premier prélèvement aura lieu le " +
              fullDate(new Date(subscription.renewsAt)) +
              "."
            : subscription.status === "cancelled"
              ? "Accès maintenu jusqu'au " +
                fullDate(new Date(subscription.renewsAt)) +
                ", puis fiche masquée."
              : "Renouvellement automatique le " +
                fullDate(new Date(subscription.renewsAt)) +
                "."}
        </Text>
      </View>

      {/* ── Plans ────────────────────────────────────────────────────── */}
      <View style={{ gap: spacing.md }}>
        <Text style={[typography.overline, { color: theme.foreground.gray }]}>
          FORMULES
        </Text>

        {PLANS.map((plan) => {
          const active =
            plan.id === subscription.plan &&
            subscription.status !== "cancelled";
          return (
            <Pressable
              key={plan.id}
              onPress={() => void select(plan.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                {
                  padding: spacing.lg,
                  borderRadius: radius.xl,
                  backgroundColor: theme.surface.raised,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? theme.primary.main : theme.divider,
                  gap: spacing.sm,
                  opacity: pressed ? 0.85 : 1,
                },
                elevation(active ? 2 : 1, theme.shadow),
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <Text
                  style={[typography.h2, { color: theme.foreground.white }]}
                >
                  {plan.label}
                </Text>
                {plan.saving ? (
                  <View
                    style={{
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 2,
                      borderRadius: radius.full,
                      backgroundColor: theme.success + "1f",
                    }}
                  >
                    <Text
                      style={[typography.caption, { color: theme.success }]}
                    >
                      {plan.saving}
                    </Text>
                  </View>
                ) : null}
                <View style={{ flex: 1 }} />
                {busy === plan.id ? (
                  <ActivityIndicator color={theme.primary.main} />
                ) : active ? (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={22}
                    color={theme.primary.main}
                  />
                ) : null}
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  gap: spacing.xs,
                }}
              >
                <Text
                  style={[typography.display, { color: theme.accent.warm }]}
                >
                  {formatAmount(plan.price)}
                </Text>
                <Text
                  style={[
                    typography.bodySmall,
                    { color: theme.foreground.gray },
                  ]}
                >
                  {plan.period}
                </Text>
              </View>

              <Text
                style={[typography.caption, { color: theme.foreground.gray }]}
              >
                {plan.hint}
              </Text>
            </Pressable>
          );
        })}
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

      {/* ── Billing ──────────────────────────────────────────────────── */}
      <View style={{ gap: spacing.md }}>
        <Group title="Facturation">
          <RowShell
            icon="credit-card-outline"
            label="Moyen de paiement"
            value={
              Platform.OS === "ios"
                ? "Achat intégré Apple"
                : "Google Play Facturation"
            }
          />
          <RowShell
            icon="calendar-clock-outline"
            label="Prochain prélèvement"
            value={fullDate(new Date(subscription.renewsAt))}
          />
          <RowShell
            icon="storefront-outline"
            label="Salon facturé"
            value={profile?.name ?? "—"}
            isLast
          />
        </Group>
        <Text style={[typography.caption, { color: theme.foreground.gray }]}>
          Le paiement passera par la boutique de votre téléphone : rien
          n&apos;est débité par cette démo.
        </Text>
      </View>

      {subscription.status === "cancelled" ? (
        <Button
          label="Réactiver mon abonnement"
          onPress={() => void reactivateSubscription()}
          background={theme.primary.main}
          color={theme.primary.on}
        />
      ) : (
        <Button
          label="Résilier l'abonnement"
          variant="outline"
          background={theme.danger}
          color={theme.danger}
          onPress={confirmCancel}
          loading={busy === "cancel"}
        />
      )}

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

      {/* ── Dev ──────────────────────────────────────────────────────── */}
      <Group title="Développement">
        <Row
          icon="calendar-alert-outline"
          label="Simuler J-7 avant fin d'abonnement"
          value="Bandeau rouge sur le tableau de bord"
          onPress={() => void simulateSubscriptionEnd(6, "cancelled")}
        />
        <Row
          icon="lock-alert-outline"
          label="Simuler un abonnement expiré"
          value="Bloque l'espace pro entier"
          onPress={() => void simulateSubscriptionEnd(-1, "cancelled")}
        />
        <Row
          icon="restore"
          label="Réinitialiser l'espace pro"
          value="Prestations, agenda, avis et abonnement de démo"
          tone="danger"
          onPress={handleResetWorkspace}
          isLast
        />
      </Group>
    </ScrollView>
  );
}
