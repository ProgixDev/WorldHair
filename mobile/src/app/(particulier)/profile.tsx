import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RatingStars } from "../../components/ui/RatingStars";
import { elevation, TAB_BAR_CLEARANCE } from "../../constants/elevation";
import { useResponsive } from "../../constants/responsive";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useAuth } from "../../contexts/AuthContext";
import { useLocation } from "../../contexts/LocationContext";
import { useTheme } from "../../contexts/ThemeContext";
import { ROUTES } from "../../features/auth/routing";
import {
  mapEngineDetail,
  mapEngineLabel,
} from "../../features/salons/mapProvider";
import { getSalonById } from "../../features/salons/data";
import {
  coverFor,
  coverPlaceholder,
  initials,
} from "../../features/salons/images";
import type { Salon } from "../../features/salons/types";
import { resetMockAuth } from "../../services/auth";
import {
  isUpcoming,
  listAppointments,
  listUserReviews,
  resetBookingData,
  salonNameFor,
  serviceNameFor,
  type Appointment,
} from "../../services/booking";
import {
  clearPreferences,
  DEFAULT_NOTIFICATIONS,
  getNotificationPrefs,
  setNotificationPrefs,
  type NotificationPrefs,
} from "../../services/preferences";
import { monthAndYear, relativeDay, timeOfDay } from "../../utils/date";

/**
 * Account tab: a portrait header, the user's own numbers, their next
 * appointment and the salons they keep going back to — then the settings.
 * Deliberately identity-first, where the other tabs are catalogue-first.
 */
export default function Profile() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();
  const { session, signOut } = useAuth();
  const { status, isFallback, manualLabel, enable } = useLocation();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationPrefs>(
    DEFAULT_NOTIFICATIONS,
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([
        listAppointments(),
        listUserReviews(),
        getNotificationPrefs(),
      ]).then(([bookings, reviews, prefs]) => {
        if (cancelled) return;
        setAppointments(bookings);
        setReviewCount(reviews.length);
        setNotifications(prefs);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const { upcoming, completed, nextAppointment, visitedSalons } =
    useMemo(() => {
      const now = new Date();
      const future = appointments
        .filter((a) => isUpcoming(a, now))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      const done = appointments.filter(
        (a) => a.status === "confirmed" && !isUpcoming(a, now),
      );

      // Salons the user actually went to, most recent first.
      const seen = new Set<string>();
      const salons: Salon[] = [];
      [...done]
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
        .forEach((appointment) => {
          if (seen.has(appointment.salonId)) return;
          seen.add(appointment.salonId);
          const salon = getSalonById(appointment.salonId);
          if (salon) salons.push(salon);
        });

      return {
        upcoming: future,
        completed: done,
        nextAppointment: future[0] ?? null,
        visitedSalons: salons,
      };
    }, [appointments]);

  const profile = session?.profile;
  const fullName = profile
    ? profile.firstName + " " + profile.lastName
    : "Votre profil";
  const memberSince = session?.createdAt
    ? monthAndYear(new Date(session.createdAt))
    : null;

  const updateNotifications = (patch: Partial<NotificationPrefs>) => {
    const next = { ...notifications, ...patch };
    setNotifications(next);
    void setNotificationPrefs(next);
  };

  const handleSignOut = () => {
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
  };

  const handleResetDemo = () => {
    Alert.alert(
      "Réinitialiser les données démo ?",
      "Rendez-vous et avis enregistrés sur cet appareil seront effacés.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Effacer",
          style: "destructive",
          onPress: async () => {
            await resetBookingData();
            setAppointments([]);
            setReviewCount(0);
          },
        },
      ],
    );
  };

  const handleReplayOnboarding = () => {
    Alert.alert(
      "Rejouer l'onboarding ?",
      "La session, les comptes de test, les rendez-vous et les avis locaux seront effacés.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Tout effacer",
          style: "destructive",
          onPress: async () => {
            await signOut();
            await Promise.all([
              resetMockAuth(),
              resetBookingData(),
              clearPreferences(),
            ]);
            router.replace(ROUTES.onboarding as never);
          },
        },
      ],
    );
  };

  const locationLabel = manualLabel
    ? manualLabel + " (choisie manuellement)"
    : status === "granted" && !isFallback
      ? "Position activée"
      : "Position désactivée";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background.dark }}
      contentContainerStyle={{
        paddingBottom: Math.max(insets.bottom, spacing.md) + TAB_BAR_CLEARANCE,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={{ paddingBottom: spacing.xl }}>
        <LinearGradient
          colors={[theme.primary.soft, theme.background.dark]}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 190,
          }}
        />

        <View
          style={{
            paddingTop: insets.top + spacing.lg,
            paddingHorizontal: gutter,
            gap: spacing.lg,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.lg,
            }}
          >
            <View
              style={[
                {
                  width: 84,
                  height: 84,
                  borderRadius: radius.full,
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.surface.raised,
                  borderWidth: 2,
                  borderColor: theme.accent.warm,
                },
                elevation(2, theme.shadow),
              ]}
            >
              {profile?.photoUri ? (
                <Image
                  source={{ uri: profile.photoUri }}
                  style={{ width: 84, height: 84 }}
                  contentFit="cover"
                />
              ) : (
                <Text style={[typography.h1, { color: theme.accent.warm }]}>
                  {profile ? initials(fullName) : "?"}
                </Text>
              )}
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={[typography.h1, { color: theme.foreground.white }]}
                numberOfLines={1}
              >
                {fullName}
              </Text>
              <Text
                style={[typography.bodySmall, { color: theme.foreground.gray }]}
                numberOfLines={1}
              >
                {session?.email ?? ""}
              </Text>
              {memberSince ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                    marginTop: spacing.xs,
                  }}
                >
                  <MaterialCommunityIcons
                    name="shimmer"
                    size={13}
                    color={theme.accent.warm}
                  />
                  <Text
                    style={[typography.caption, { color: theme.accent.warm }]}
                  >
                    {"Membre depuis " + memberSince}
                  </Text>
                </View>
              ) : null}
            </View>

            <Pressable
              onPress={() => router.push(ROUTES.profileSetup as never)}
              accessibilityRole="button"
              accessibilityLabel="Modifier mon profil"
              hitSlop={8}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: radius.full,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.surface.raised,
                borderWidth: 1,
                borderColor: theme.border,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <MaterialCommunityIcons
                name="pencil-outline"
                size={19}
                color={theme.foreground.white}
              />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Stat
              label="RDV à venir"
              value={upcoming.length}
              icon="calendar-clock"
            />
            <Stat
              label="Prestations"
              value={completed.length}
              icon="content-cut"
            />
            <Stat label="Avis" value={reviewCount} icon="star-outline" />
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: gutter, gap: spacing.xl }}>
        {/* ── Next appointment ─────────────────────────────────────────── */}
        {nextAppointment ? (
          <View style={{ gap: spacing.md }}>
            <Text
              style={[typography.overline, { color: theme.foreground.gray }]}
            >
              PROCHAIN RENDEZ-VOUS
            </Text>

            <Pressable
              onPress={() => router.push(ROUTES.appointments as never)}
              accessibilityRole="button"
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.lg,
                  padding: spacing.md,
                  borderRadius: radius.xl,
                  backgroundColor: theme.surface.raised,
                  borderWidth: 1.5,
                  borderColor: theme.primary.main,
                  opacity: pressed ? 0.85 : 1,
                },
                elevation(2, theme.shadow),
              ]}
            >
              <Image
                source={coverFor({ id: nextAppointment.salonId }, 300)}
                placeholder={coverPlaceholder(nextAppointment.salonId)}
                placeholderContentFit="cover"
                cachePolicy="memory-disk"
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: radius.lg,
                  backgroundColor: theme.surface.sunken,
                }}
                contentFit="cover"
                transition={200}
              />

              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[typography.label, { color: theme.primary.main }]}>
                  {relativeDay(new Date(nextAppointment.startsAt)) +
                    " · " +
                    timeOfDay(new Date(nextAppointment.startsAt))}
                </Text>
                <Text
                  style={[
                    typography.bodyMedium,
                    { color: theme.foreground.white },
                  ]}
                  numberOfLines={1}
                >
                  {salonNameFor(nextAppointment)}
                </Text>
                <Text
                  style={[typography.caption, { color: theme.foreground.gray }]}
                  numberOfLines={1}
                >
                  {serviceNameFor(nextAppointment)}
                </Text>
              </View>

              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={theme.foreground.gray}
              />
            </Pressable>
          </View>
        ) : null}

        {/* ── Salons visited ───────────────────────────────────────────── */}
        {visitedSalons.length > 0 ? (
          <View style={{ gap: spacing.md }}>
            <Text
              style={[typography.overline, { color: theme.foreground.gray }]}
            >
              VOS SALONS
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.md }}
              style={{ marginHorizontal: -gutter }}
            >
              <View style={{ width: gutter }} />
              {visitedSalons.map((salon) => (
                <Pressable
                  key={salon.id}
                  onPress={() => router.push(("/salon/" + salon.id) as never)}
                  accessibilityRole="button"
                  accessibilityLabel={salon.name}
                  style={({ pressed }) => ({
                    width: 148,
                    gap: spacing.sm,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Image
                    source={coverFor(salon, 400)}
                    placeholder={coverPlaceholder(salon.id)}
                    placeholderContentFit="cover"
                    cachePolicy="memory-disk"
                    style={{
                      width: 148,
                      height: 108,
                      borderRadius: radius.lg,
                      backgroundColor: theme.surface.sunken,
                    }}
                    contentFit="cover"
                    transition={200}
                  />
                  <Text
                    style={[
                      typography.label,
                      { color: theme.foreground.white },
                    ]}
                    numberOfLines={1}
                  >
                    {salon.name}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.xs,
                    }}
                  >
                    <RatingStars value={salon.rating} size={11} showValue />
                    <Text
                      style={[
                        typography.caption,
                        { color: theme.foreground.gray },
                      ]}
                      numberOfLines={1}
                    >
                      {salon.city}
                    </Text>
                  </View>
                </Pressable>
              ))}
              <View style={{ width: gutter }} />
            </ScrollView>
          </View>
        ) : null}

        {/* ── Reminders ────────────────────────────────────────────────── */}
        <Group title="Rappels de rendez-vous">
          <ToggleRow
            icon="calendar-alert"
            label="Rappel la veille"
            value="Notification à J-1"
            enabled={notifications.reminderDayBefore}
            onChange={(reminderDayBefore) =>
              updateNotifications({ reminderDayBefore })
            }
          />
          <ToggleRow
            icon="clock-alert-outline"
            label="Rappel une heure avant"
            value="Notification à H-1"
            enabled={notifications.reminderHourBefore}
            onChange={(reminderHourBefore) =>
              updateNotifications({ reminderHourBefore })
            }
            isLast
          />
        </Group>
        <Text
          style={[
            typography.caption,
            { color: theme.foreground.gray, marginTop: -spacing.md },
          ]}
        >
          Les confirmations et annulations de rendez-vous restent toujours
          envoyées.
        </Text>

        {/* ── Preferences ──────────────────────────────────────────────── */}
        <Group title="Préférences">
          <Row
            icon="crosshairs-gps"
            label="Localisation"
            value={locationLabel}
            onPress={() => void enable()}
          />
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
          <Row
            icon="account-edit-outline"
            label="Modifier mon profil"
            value="Prénom, nom et photo"
            onPress={() => router.push(ROUTES.profileSetup as never)}
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
            icon="map-outline"
            label="Moteur de carte"
            value={mapEngineLabel()}
            onPress={() =>
              Alert.alert(
                "Moteur de carte : " + mapEngineLabel(),
                mapEngineDetail(),
              )
            }
          />
          <Row
            icon="gesture-swipe-horizontal"
            label="Rejouer l'onboarding"
            value="Efface la session et les comptes de test"
            onPress={handleReplayOnboarding}
          />
          <Row
            icon="restore"
            label="Réinitialiser les données démo"
            value="RDV et avis locaux"
            tone="danger"
            onPress={handleResetDemo}
            isLast
          />
        </Group>
      </View>
    </ScrollView>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        {
          flex: 1,
          paddingVertical: spacing.lg,
          paddingHorizontal: spacing.md,
          borderRadius: radius.xl,
          backgroundColor: theme.surface.raised,
          borderWidth: 1,
          borderColor: theme.divider,
          gap: spacing.xs,
        },
        elevation(1, theme.shadow),
      ]}
    >
      <MaterialCommunityIcons name={icon} size={16} color={theme.accent.warm} />
      <Text style={[typography.h1, { color: theme.foreground.white }]}>
        {value}
      </Text>
      <Text
        style={[typography.caption, { color: theme.foreground.gray }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={[typography.overline, { color: theme.foreground.gray }]}>
        {title.toUpperCase()}
      </Text>
      <View
        style={[
          {
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: theme.divider,
            overflow: "hidden",
          },
          elevation(1, theme.shadow),
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function RowShell({
  icon,
  label,
  value,
  tone = "default",
  right,
  onPress,
  isLast,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value?: string;
  tone?: "default" | "danger";
  right: React.ReactNode;
  onPress?: () => void;
  isLast?: boolean;
}) {
  const { theme } = useTheme();
  const color = tone === "danger" ? theme.danger : theme.primary.main;

  const content = (pressed: boolean) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        minHeight: 64,
        borderBottomWidth: isLast ? 0 : 1,
        borderColor: theme.divider,
        backgroundColor:
          pressed && onPress ? theme.surface.raised : theme.surface.base,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: radius.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor:
            tone === "danger" ? theme.danger + "1f" : theme.primary.soft,
        }}
      >
        <MaterialCommunityIcons name={icon} size={19} color={color} />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={[
            typography.bodyMedium,
            {
              color: tone === "danger" ? theme.danger : theme.foreground.white,
            },
          ]}
        >
          {label}
        </Text>
        {value ? (
          <Text
            style={[typography.caption, { color: theme.foreground.gray }]}
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : null}
      </View>

      {right}
    </View>
  );

  if (!onPress) return content(false);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}

function Row(props: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  tone?: "default" | "danger";
  isLast?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <RowShell
      {...props}
      right={
        <MaterialCommunityIcons
          name="chevron-right"
          size={18}
          color={theme.foreground.gray}
        />
      }
    />
  );
}

function ToggleRow({
  icon,
  label,
  value,
  enabled,
  onChange,
  isLast,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value?: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  isLast?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <RowShell
      icon={icon}
      label={label}
      value={value}
      isLast={isLast}
      right={
        <Switch
          value={enabled}
          onValueChange={onChange}
          accessibilityLabel={label}
          trackColor={{ false: theme.surface.sunken, true: theme.primary.main }}
          thumbColor={enabled ? theme.primary.on : theme.foreground.gray}
        />
      }
    />
  );
}
