import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { elevation, TAB_BAR_CLEARANCE } from "../../constants/elevation";
import { useResponsive } from "../../constants/responsive";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { usePro } from "../../contexts/ProContext";
import { useTheme } from "../../contexts/ThemeContext";
import { ROUTES } from "../../features/auth/routing";
import {
  appointmentsForDay,
  computeStats,
  serviceName,
  weeklySeries,
} from "../../features/pro/stats";
import {
  avatarFor,
  coverFor,
  coverPlaceholder,
} from "../../features/salons/images";
import {
  formatAmount,
  formatPrice,
  relativeDay,
  timeOfDay,
  weekdayLong,
} from "../../utils/date";

/**
 * Command centre: KPI grid, an eight-week bar chart, the requests still to
 * answer and today's chairs. Data-dense on purpose — nothing else in the app
 * looks like this.
 */
export default function ProDashboard() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter, width, isExpanded } = useResponsive();
  // On a tablet, one row of four beats two stretched-out rows of two.
  const kpiColumns = isExpanded ? 4 : 2;
  const kpiWidth =
    (width - gutter * 2 - spacing.md * (kpiColumns - 1)) / kpiColumns;
  const { profile, services, appointments, subscription, isLoading } = usePro();

  const stats = useMemo(() => computeStats(appointments), [appointments]);
  const series = useMemo(() => weeklySeries(appointments, 8), [appointments]);
  const today = useMemo(
    () => appointmentsForDay(appointments, new Date()),
    [appointments],
  );
  const pending = useMemo(
    () => appointments.filter((a) => a.status === "pending").slice(0, 3),
    [appointments],
  );

  if (isLoading || !profile)
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

  const trialDaysLeft = subscription?.trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.trialEndsAt).getTime() - Date.now()) /
            86400000,
        ),
      )
    : null;

  const maxWeek = Math.max(...series.map((week) => week.count), 1);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background.dark }}
      contentContainerStyle={{
        paddingBottom: Math.max(insets.bottom, spacing.md) + TAB_BAR_CLEARANCE,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={{ paddingBottom: spacing.lg }}>
        <LinearGradient
          colors={[theme.primary.soft, theme.background.dark]}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 170,
          }}
        />
        <View
          style={{
            paddingTop: insets.top + spacing.lg,
            paddingHorizontal: gutter,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.lg,
          }}
        >
          <Image
            source={coverFor({ id: profile.salonId }, 200)}
            placeholder={coverPlaceholder(profile.salonId)}
            placeholderContentFit="cover"
            cachePolicy="memory-disk"
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.lg,
              backgroundColor: theme.surface.sunken,
            }}
            contentFit="cover"
            transition={200}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[typography.caption, { color: theme.primary.main }]}>
              ESPACE PRO
            </Text>
            <Text
              style={[typography.h1, { color: theme.foreground.white }]}
              numberOfLines={1}
            >
              {profile.name}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: gutter, gap: spacing.xl }}>
        {/* ── Trial / subscription strip ───────────────────────────────── */}
        {subscription ? (
          <Pressable
            onPress={() => router.push(ROUTES.proAccount as never)}
            accessibilityRole="button"
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.lg,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor:
                  subscription.status === "cancelled"
                    ? theme.danger
                    : theme.primary.main,
                backgroundColor: theme.primary.soft,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={
                subscription.status === "cancelled"
                  ? "alert-circle-outline"
                  : "crown-outline"
              }
              size={22}
              color={
                subscription.status === "cancelled"
                  ? theme.danger
                  : theme.primary.main
              }
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={[typography.label, { color: theme.foreground.white }]}
              >
                {subscription.status === "trial"
                  ? "Essai gratuit — " + trialDaysLeft + " jours restants"
                  : subscription.status === "cancelled"
                    ? "Abonnement résilié"
                    : "Abonnement actif"}
              </Text>
              <Text
                style={[typography.caption, { color: theme.foreground.gray }]}
              >
                {subscription.status === "cancelled"
                  ? "Votre fiche sera masquée à la fin de la période."
                  : "Formule " +
                    (subscription.plan === "yearly" ? "annuelle" : "mensuelle")}
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={theme.foreground.gray}
            />
          </Pressable>
        ) : null}

        {/* ── KPI grid ─────────────────────────────────────────────────── */}
        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}
        >
          <Kpi
            label="RDV cette semaine"
            value={String(stats.bookingsThisWeek)}
            trend={stats.weekTrend}
            icon="calendar-week"
            width={kpiWidth}
          />
          <Kpi
            label="CA du mois"
            value={formatAmount(stats.revenueThisMonth)}
            icon="cash-multiple"
            width={kpiWidth}
          />
          <Kpi
            label="Panier moyen"
            value={formatPrice(stats.averageBasket)}
            icon="tag-outline"
            width={kpiWidth}
          />
          <Kpi
            label="Taux d'acceptation"
            value={stats.acceptanceRate + " %"}
            icon="check-decagram-outline"
            width={kpiWidth}
          />
        </View>

        {/* ── Weekly bars ──────────────────────────────────────────────── */}
        <View style={{ gap: spacing.md }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={[typography.overline, { color: theme.foreground.gray }]}
            >
              8 DERNIÈRES SEMAINES
            </Text>
            <Text
              style={[typography.caption, { color: theme.foreground.gray }]}
            >
              {stats.busiestWeekday !== null
                ? "Jour fort : " +
                  weekdayLong(new Date(2026, 7, 16 + stats.busiestWeekday))
                : ""}
            </Text>
          </View>

          <View
            style={[
              {
                padding: spacing.lg,
                borderRadius: radius.xl,
                backgroundColor: theme.surface.raised,
                borderWidth: 1,
                borderColor: theme.divider,
                gap: spacing.md,
              },
              elevation(1, theme.shadow),
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-end",
                justifyContent: "space-between",
                height: 128,
                gap: spacing.xs,
              }}
            >
              {series.map((week, index) => {
                const isCurrent = index === series.length - 1;
                return (
                  <View
                    key={week.label}
                    style={{ flex: 1, alignItems: "center", gap: spacing.xs }}
                  >
                    <Text
                      style={[
                        typography.caption,
                        {
                          fontSize: 10,
                          color: isCurrent
                            ? theme.primary.main
                            : theme.foreground.gray,
                        },
                      ]}
                    >
                      {week.count}
                    </Text>
                    <View
                      style={{
                        width: "100%",
                        height: Math.max(6, (week.count / maxWeek) * 88),
                        borderRadius: radius.sm,
                        backgroundColor: isCurrent
                          ? theme.primary.main
                          : theme.primary.soft,
                        borderWidth: isCurrent ? 0 : 1,
                        borderColor: theme.primary.main,
                      }}
                    />
                  </View>
                );
              })}
            </View>

            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              {series.map((week) => (
                <Text
                  key={week.label}
                  style={[
                    typography.caption,
                    {
                      flex: 1,
                      fontSize: 9,
                      textAlign: "center",
                      color: theme.foreground.gray,
                    },
                  ]}
                >
                  {week.label}
                </Text>
              ))}
            </View>
          </View>
        </View>

        {/* ── Pending requests ─────────────────────────────────────────── */}
        {pending.length > 0 ? (
          <View style={{ gap: spacing.md }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={[typography.overline, { color: theme.foreground.gray }]}
              >
                {"DEMANDES EN ATTENTE (" + stats.pending + ")"}
              </Text>
              <Pressable
                onPress={() => router.push(ROUTES.proAgenda as never)}
                accessibilityRole="link"
                hitSlop={8}
              >
                <Text style={[typography.label, { color: theme.primary.main }]}>
                  Tout voir
                </Text>
              </Pressable>
            </View>

            {pending.map((appointment) => (
              <Pressable
                key={appointment.id}
                onPress={() => router.push(ROUTES.proAgenda as never)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    padding: spacing.md,
                    borderRadius: radius.lg,
                    backgroundColor: theme.surface.base,
                    borderWidth: 1,
                    borderColor: theme.divider,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Image
                  source={avatarFor(appointment.clientId, profile.salonId)}
                  cachePolicy="memory-disk"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.full,
                    backgroundColor: theme.surface.sunken,
                  }}
                  contentFit="cover"
                  transition={200}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={[
                      typography.label,
                      { color: theme.foreground.white },
                    ]}
                    numberOfLines={1}
                  >
                    {appointment.clientName}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      { color: theme.foreground.gray },
                    ]}
                    numberOfLines={1}
                  >
                    {serviceName(services, appointment.serviceId) +
                      " · " +
                      relativeDay(new Date(appointment.startsAt)) +
                      " " +
                      timeOfDay(new Date(appointment.startsAt))}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={theme.foreground.gray}
                />
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* ── Today ────────────────────────────────────────────────────── */}
        <View style={{ gap: spacing.md }}>
          <Text style={[typography.overline, { color: theme.foreground.gray }]}>
            {"AUJOURD'HUI (" + today.length + ")"}
          </Text>

          {today.length === 0 ? (
            <View
              style={{
                padding: spacing.lg,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: theme.border,
              }}
            >
              <Text
                style={[typography.bodySmall, { color: theme.foreground.gray }]}
              >
                Aucun rendez-vous aujourd&apos;hui. Bonne journée !
              </Text>
            </View>
          ) : (
            today.map((appointment) => (
              <View
                key={appointment.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <Text
                  style={[
                    typography.label,
                    { color: theme.primary.main, width: 48 },
                  ]}
                >
                  {timeOfDay(new Date(appointment.startsAt))}
                </Text>
                <View
                  style={{
                    width: 2,
                    alignSelf: "stretch",
                    borderRadius: radius.full,
                    backgroundColor: theme.divider,
                  }}
                />
                <View style={{ flex: 1, paddingVertical: spacing.sm, gap: 2 }}>
                  <Text
                    style={[
                      typography.bodyMedium,
                      { color: theme.foreground.white },
                    ]}
                    numberOfLines={1}
                  >
                    {appointment.clientName}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      { color: theme.foreground.gray },
                    ]}
                    numberOfLines={1}
                  >
                    {serviceName(services, appointment.serviceId) +
                      " · " +
                      formatPrice(appointment.price)}
                  </Text>
                </View>
                {appointment.status === "pending" ? (
                  <Text style={[typography.caption, { color: theme.danger }]}>
                    À confirmer
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        {/* ── Top services ─────────────────────────────────────────────── */}
        {stats.topServices.length > 0 ? (
          <View style={{ gap: spacing.md }}>
            <Text
              style={[typography.overline, { color: theme.foreground.gray }]}
            >
              PRESTATIONS LES PLUS RÉSERVÉES
            </Text>
            {stats.topServices.map((entry) => {
              const max = stats.topServices[0].count || 1;
              return (
                <View key={entry.serviceId} style={{ gap: spacing.xs }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={[
                        typography.bodySmall,
                        { color: theme.foreground.white, flex: 1 },
                      ]}
                      numberOfLines={1}
                    >
                      {serviceName(services, entry.serviceId)}
                    </Text>
                    <Text
                      style={[
                        typography.caption,
                        { color: theme.foreground.gray },
                      ]}
                    >
                      {entry.count + " · " + formatAmount(entry.revenue)}
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 6,
                      borderRadius: radius.full,
                      backgroundColor: theme.surface.sunken,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        width: (Math.round((entry.count / max) * 100) +
                          "%") as `${number}%`,
                        height: "100%",
                        backgroundColor: theme.primary.main,
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Kpi({
  label,
  value,
  icon,
  trend,
  width,
}: {
  label: string;
  value: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  trend?: number | null;
  width: number;
}) {
  const { theme } = useTheme();
  const up = (trend ?? 0) >= 0;

  return (
    <View
      style={[
        {
          width,
          padding: spacing.lg,
          borderRadius: radius.xl,
          backgroundColor: theme.surface.raised,
          borderWidth: 1,
          borderColor: theme.divider,
          gap: spacing.xs,
        },
        elevation(1, theme.shadow),
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={17}
        color={theme.primary.main}
      />
      <Text style={[typography.h1, { color: theme.foreground.white }]}>
        {value}
      </Text>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
      >
        <Text
          style={[
            typography.caption,
            { color: theme.foreground.gray, flex: 1 },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {trend !== undefined && trend !== null ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
            <MaterialCommunityIcons
              name={up ? "trending-up" : "trending-down"}
              size={13}
              color={up ? theme.success : theme.danger}
            />
            <Text
              style={[
                typography.caption,
                { color: up ? theme.success : theme.danger },
              ]}
            >
              {Math.abs(trend) + " %"}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
