import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { CompletionCodeSheet } from "../../components/pro/CompletionCodeSheet";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { elevation } from "../../constants/elevation";
import { useResponsive } from "../../constants/responsive";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { ROUTES } from "../../features/auth/routing";
import { canShowCompletionCode, confirmedLabel } from "../../features/pro/presence";
import { servicesLabel } from "../../features/pro/stats";
import type { Attendance, ProAppointment } from "../../features/pro/types";
import { avatarFor, initials } from "../../features/salons/images";
import { canMarkAttendance, staffAgendaSections, timeRange } from "../../features/staff/agenda";
import { listMyAppointments, setMyAttendance, staffErrorMessage } from "../../services/staff";
import { formatDuration, relativeDay } from "../../utils/date";

/** « Honoré » / « Absent » show up as a booking starts, without a pull. */
const CLOCK_TICK_MS = 60_000;

/**
 * A staff member's own agenda (TODO.md Phase 3): the bookings the salon
 * gave them, read-only — accepting, moving and cancelling stay with the
 * owner. Once a booking has started they mark whether the client came, or
 * show the end-of-service code the client scans (« Afficher le code de fin »).
 */
export default function StaffAgenda() {
  const router = useRouter();
  const { theme } = useTheme();
  const { gutter } = useResponsive();
  const { session, refresh } = useAuth();

  const [appointments, setAppointments] = useState<ProAppointment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // The code's booking stays set while the sheet slides away.
  const [codeFor, setCodeFor] = useState<ProAppointment | null>(null);
  const [codeVisible, setCodeVisible] = useState(false);
  const [now, setNow] = useState(() => new Date());

  // `refresh` changes with every session; held here so loading on focus
  // doesn't start over each time it refreshes the session itself.
  const refreshSession = useRef(refresh);
  useEffect(() => {
    refreshSession.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  /**
   * Their bookings, with the session read again alongside: someone the
   * owner removed meanwhile goes to « Rejoindre un salon ».
   */
  const load = useCallback(async () => {
    try {
      const [list, next] = await Promise.all([
        listMyAppointments(),
        refreshSession.current().catch(() => undefined),
      ]);
      if (next?.role === "staff" && next.staffMembership === null) {
        router.replace(ROUTES.joinSalon as never);
        return;
      }
      setAppointments(list);
      setLoadError(null);
      setNow(new Date());
    } catch (err) {
      setLoadError(staffErrorMessage(err));
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const pullToRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const retry = async () => {
    setRetrying(true);
    await load();
    setRetrying(false);
  };

  const mark = async (appointment: ProAppointment, attendance: Attendance) => {
    setBusyId(appointment.id);
    try {
      setAppointments(await setMyAttendance(appointment.id, attendance));
    } catch (err) {
      Alert.alert("Action impossible", staffErrorMessage(err));
      // Likely out of date (given to someone else, marked meanwhile): show what's true now.
      void load();
    } finally {
      setBusyId(null);
    }
  };

  const sections = useMemo(() => staffAgendaSections(appointments ?? [], now), [appointments, now]);
  const total = sections.today.length + sections.upcoming.length + sections.past.length;
  const salonName = session?.staffMembership?.salonName ?? null;
  const profile = session?.profile ?? null;

  const card = (appointment: ProAppointment, showDay: boolean) => (
    <BookingCard
      key={appointment.id}
      appointment={appointment}
      showDay={showDay}
      now={now}
      busy={busyId === appointment.id}
      onMark={(attendance) => void mark(appointment, attendance)}
      onShowCode={() => {
        setCodeFor(appointment);
        setCodeVisible(true);
      }}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background.dark }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: gutter,
          paddingTop: spacing.md,
          paddingBottom: spacing.xxl,
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void pullToRefresh()}
            tintColor={theme.primary.main}
            colors={[theme.primary.main]}
            progressBackgroundColor={theme.surface.raised}
          />
        }
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            {salonName ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                <MaterialCommunityIcons name="storefront-outline" size={14} color={theme.accent.warm} />
                <Text style={[typography.overline, { color: theme.accent.warm, flex: 1 }]} numberOfLines={1}>
                  {salonName.toUpperCase()}
                </Text>
              </View>
            ) : null}
            <Text style={[typography.display, { color: theme.foreground.white }]} accessibilityRole="header">
              Mon agenda
            </Text>
          </View>

          <Pressable
            onPress={() => router.push(ROUTES.staffAccount as never)}
            accessibilityRole="button"
            accessibilityLabel="Mon compte"
            hitSlop={8}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: radius.full,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.surface.raised,
              borderWidth: 1.5,
              borderColor: theme.accent.warm,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            {profile?.photoUri ? (
              <Image source={{ uri: profile.photoUri }} style={{ width: 44, height: 44 }} contentFit="cover" />
            ) : profile ? (
              <Text style={[typography.label, { color: theme.accent.warm }]}>
                {initials(profile.firstName + " " + profile.lastName)}
              </Text>
            ) : (
              <MaterialCommunityIcons name="account-outline" size={20} color={theme.accent.warm} />
            )}
          </Pressable>
        </View>

        {appointments === null ? (
          loadError ? (
            <LoadFailed message={loadError} busy={retrying} onRetry={() => void retry()} />
          ) : (
            <ActivityIndicator color={theme.primary.main} style={{ marginTop: spacing.xxl }} />
          )
        ) : (
          <>
            {/* Shown over what was already there: the last list stays readable. */}
            {loadError ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  padding: spacing.md,
                  borderRadius: radius.lg,
                  backgroundColor: theme.surface.sunken,
                }}
              >
                <MaterialCommunityIcons name="wifi-off" size={18} color={theme.foreground.gray} />
                <Text style={[typography.caption, { color: theme.foreground.gray, flex: 1 }]}>
                  {"Agenda pas à jour. " + loadError}
                </Text>
              </View>
            ) : null}

            {total === 0 ? (
              <EmptyState
                icon="calendar-blank-outline"
                title="Aucun rendez-vous pour l'instant."
                message="Le salon vous attribue vos rendez-vous."
              />
            ) : (
              <>
                <Section title="Aujourd'hui" count={sections.today.length}>
                  {sections.today.length > 0 ? (
                    sections.today.map((appointment) => card(appointment, false))
                  ) : (
                    <View
                      style={{
                        padding: spacing.lg,
                        borderRadius: radius.xl,
                        borderWidth: 1,
                        borderStyle: "dashed",
                        borderColor: theme.border,
                        alignItems: "center",
                      }}
                    >
                      <Text style={[typography.bodySmall, { color: theme.foreground.gray }]}>
                        Rien de prévu aujourd&apos;hui.
                      </Text>
                    </View>
                  )}
                </Section>

                {sections.upcoming.length > 0 ? (
                  <Section title="À venir" count={sections.upcoming.length}>
                    {sections.upcoming.map((appointment) => card(appointment, true))}
                  </Section>
                ) : null}

                {sections.past.length > 0 ? (
                  <Section title="Passés" hint="30 derniers jours">
                    {sections.past.map((appointment) => card(appointment, true))}
                  </Section>
                ) : null}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* The client confirmed: read the list again so the card says so. */}
      <CompletionCodeSheet
        appointment={codeFor}
        visible={codeVisible}
        onClose={() => setCodeVisible(false)}
        onConfirmed={() => void load()}
      />
    </View>
  );
}

function Section({
  title,
  count,
  hint,
  children,
}: {
  title: string;
  count?: number;
  hint?: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
        <Text style={[typography.overline, { color: theme.foreground.gray }]}>
          {title.toUpperCase() + (count ? " · " + count : "")}
        </Text>
        {hint ? <Text style={[typography.caption, { color: theme.foreground.gray }]}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** One booking: who, when, what — and once it has started, the code the client scans and whether they came. */
function BookingCard({
  appointment,
  showDay,
  now,
  busy,
  onMark,
  onShowCode,
}: {
  appointment: ProAppointment;
  showDay: boolean;
  now: Date;
  busy: boolean;
  onMark: (attendance: Attendance) => void;
  onShowCode: () => void;
}) {
  const { theme } = useTheme();
  const start = new Date(appointment.startsAt);
  const end = start.getTime() + appointment.durationMin * 60_000;
  const inProgress = start.getTime() <= now.getTime() && now.getTime() < end;
  const markable = canMarkAttendance(appointment, now);

  return (
    <View
      style={[
        {
          padding: spacing.lg,
          borderRadius: radius.xl,
          backgroundColor: theme.surface.raised,
          borderWidth: inProgress ? 1.5 : 1,
          borderColor: inProgress ? theme.primary.main : theme.divider,
          gap: spacing.md,
        },
        elevation(1, theme.shadow),
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Image
          source={avatarFor(appointment.clientId ?? appointment.id)}
          cachePolicy="memory-disk"
          style={{ width: 46, height: 46, borderRadius: radius.full, backgroundColor: theme.surface.sunken }}
          contentFit="cover"
          transition={200}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Text style={[typography.bodyMedium, { color: theme.foreground.white, flexShrink: 1 }]} numberOfLines={1}>
              {appointment.clientName}
            </Text>
            {appointment.isNewClient ? (
              <View
                style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 2,
                  borderRadius: radius.full,
                  backgroundColor: theme.primary.soft,
                }}
              >
                <Text style={[typography.caption, { color: theme.primary.main, fontSize: 10 }]}>Nouveau</Text>
              </View>
            ) : null}
          </View>
          <Text style={[typography.caption, { color: inProgress ? theme.primary.main : theme.foreground.gray }]}>
            {(showDay ? relativeDay(start, now) + " · " : "") +
              timeRange(appointment) +
              " · " +
              formatDuration(appointment.durationMin) +
              (inProgress ? " · en cours" : "")}
          </Text>
        </View>
      </View>

      <Text style={[typography.bodySmall, { color: theme.foreground.white }]}>{servicesLabel(appointment, [])}</Text>

      {appointment.note ? (
        <View style={{ padding: spacing.md, borderRadius: radius.md, backgroundColor: theme.surface.base }}>
          <Text style={[typography.caption, { color: theme.foreground.gray }]}>{"« " + appointment.note + " »"}</Text>
        </View>
      ) : null}

      {appointment.confirmedByClientAt ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <MaterialCommunityIcons name="check-circle" size={16} color={theme.success} />
          <Text style={[typography.label, { color: theme.success, flex: 1 }]}>
            {confirmedLabel(appointment.confirmedByClientAt, now)}
          </Text>
        </View>
      ) : canShowCompletionCode(appointment, now) ? (
        <Button
          label="Afficher le code de fin"
          icon="qrcode"
          onPress={onShowCode}
          disabled={busy}
          background={theme.primary.main}
          color={theme.primary.on}
        />
      ) : null}

      {markable ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.caption, { color: theme.foreground.gray }]}>Le client est-il venu ?</Text>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Button
              label="Absent"
              variant="outline"
              background={theme.danger}
              color={theme.danger}
              onPress={() => onMark("no_show")}
              disabled={busy}
              style={{ flex: 1 }}
            />
            <Button
              label="Honoré"
              onPress={() => onMark("attended")}
              loading={busy}
              background={theme.primary.main}
              color={theme.primary.on}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : appointment.attendance ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <MaterialCommunityIcons
            name={appointment.attendance === "attended" ? "check-circle-outline" : "account-cancel-outline"}
            size={16}
            color={appointment.attendance === "attended" ? theme.success : theme.danger}
          />
          <Text
            style={[
              typography.label,
              { color: appointment.attendance === "attended" ? theme.success : theme.danger },
            ]}
          >
            {appointment.attendance === "attended" ? "Honoré" : "Absent"}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Nothing could be read yet (no network, server down): say so, with a way to try again. */
function LoadFailed({ message, busy, onRetry }: { message: string; busy: boolean; onRetry: () => void }) {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: spacing.lg, paddingVertical: spacing.xxl }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.surface.raised,
        }}
      >
        <MaterialCommunityIcons name="wifi-off" size={32} color={theme.foreground.gray} />
      </View>
      <Text style={[typography.h2, { color: theme.foreground.white, textAlign: "center" }]}>
        Impossible de charger votre agenda
      </Text>
      <Text style={[typography.body, { color: theme.foreground.gray, textAlign: "center" }]}>{message}</Text>
      <Button
        label="Réessayer"
        onPress={onRetry}
        loading={busy}
        background={theme.primary.main}
        color={theme.primary.on}
        style={{ width: "100%", maxWidth: 360 }}
      />
    </View>
  );
}
