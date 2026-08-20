import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "../../components/ui/EmptyState";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { elevation, TAB_BAR_CLEARANCE } from "../../constants/elevation";
import { useResponsive } from "../../constants/responsive";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import { getSalonById } from "../../features/salons/data";
import {
  cancelAppointment,
  isUpcoming,
  listAppointments,
  salonNameFor,
  serviceNameFor,
  type Appointment,
} from "../../services/booking";
import {
  dayAndMonth,
  formatDuration,
  formatPrice,
  relativeDay,
  timeOfDay,
} from "../../utils/date";

type Tab = "upcoming" | "past";

/**
 * Agenda as a timeline: a date rail on the left with a connector line, cards
 * on the right. Nothing here repeats the map carousel or the search index.
 */
export default function Appointments() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();

  const [tab, setTab] = useState<Tab>("upcoming");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listAppointments().then(setAppointments);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    return {
      upcoming: appointments.filter((a) => isUpcoming(a, now)),
      past: appointments
        .filter((a) => !isUpcoming(a, now))
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    };
  }, [appointments]);

  const visible = tab === "upcoming" ? upcoming : past;

  const handleCancel = (appointment: Appointment) => {
    Alert.alert(
      "Annuler ce rendez-vous ?",
      salonNameFor(appointment) +
        " · " +
        relativeDay(new Date(appointment.startsAt)) +
        " à " +
        timeOfDay(new Date(appointment.startsAt)),
      [
        { text: "Garder", style: "cancel" },
        {
          text: "Annuler le RDV",
          style: "destructive",
          onPress: async () => {
            setBusyId(appointment.id);
            try {
              await cancelAppointment(appointment.id);
              refresh();
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background.dark }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingTop: insets.top + spacing.md,
          paddingBottom:
            Math.max(insets.bottom, spacing.md) + TAB_BAR_CLEARANCE,
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: spacing.lg }}>
          <Text
            style={[typography.display, { color: theme.foreground.white }]}
            accessibilityRole="header"
          >
            Mes rendez-vous
          </Text>

          <SegmentedControl
            value={tab}
            onChange={setTab}
            options={[
              {
                value: "upcoming",
                label: "À venir",
                hint:
                  upcoming.length + " prévu" + (upcoming.length > 1 ? "s" : ""),
              },
              {
                value: "past",
                label: "Historique",
                hint: past.length + " passé" + (past.length > 1 ? "s" : ""),
              },
            ]}
          />
        </View>

        {visible.length === 0 ? (
          <EmptyState
            icon={tab === "upcoming" ? "calendar-blank-outline" : "history"}
            title={
              tab === "upcoming"
                ? "Aucun rendez-vous prévu"
                : "Rien dans l'historique"
            }
            message={
              tab === "upcoming"
                ? "Trouvez un salon près de chez vous et réservez en deux minutes."
                : "Vos rendez-vous passés apparaîtront ici, avec la possibilité de laisser un avis."
            }
            action={
              tab === "upcoming"
                ? {
                    label: "Trouver un salon",
                    onPress: () => router.push("/discover" as never),
                  }
                : undefined
            }
          />
        ) : (
          <View style={{ gap: spacing.lg }}>
            {visible.map((appointment, index) => (
              <TimelineItem
                key={appointment.id}
                appointment={appointment}
                isLast={index === visible.length - 1}
                busy={busyId === appointment.id}
                onReschedule={() =>
                  router.push(
                    ("/booking/" +
                      appointment.salonId +
                      "?appointmentId=" +
                      appointment.id) as never,
                  )
                }
                onCancel={() => handleCancel(appointment)}
                onReview={() =>
                  router.push(("/review/" + appointment.id) as never)
                }
                onOpenSalon={() =>
                  router.push(("/salon/" + appointment.salonId) as never)
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function TimelineItem({
  appointment,
  isLast,
  busy,
  onReschedule,
  onCancel,
  onReview,
  onOpenSalon,
}: {
  appointment: Appointment;
  isLast: boolean;
  busy: boolean;
  onReschedule: () => void;
  onCancel: () => void;
  onReview: () => void;
  onOpenSalon: () => void;
}) {
  const { theme } = useTheme();
  const start = new Date(appointment.startsAt);
  const cancelled = appointment.status === "cancelled";
  const upcoming = isUpcoming(appointment);
  const salon = getSalonById(appointment.salonId);

  const accent = cancelled
    ? theme.danger
    : upcoming
      ? theme.primary.main
      : theme.foreground.gray;

  return (
    <View style={{ flexDirection: "row", gap: spacing.md }}>
      {/* Date rail */}
      <View style={{ width: 52, alignItems: "center", gap: spacing.xs }}>
        <View
          style={{
            width: 56,
            paddingVertical: spacing.md,
            borderRadius: radius.lg,
            alignItems: "center",
            backgroundColor: upcoming ? theme.primary.soft : theme.surface.base,
            borderWidth: 1.5,
            borderColor: accent,
          }}
        >
          <Text style={[typography.h2, { color: theme.foreground.white }]}>
            {start.getDate()}
          </Text>
          <Text style={[typography.caption, { color: theme.foreground.gray }]}>
            {dayAndMonth(start).split(" ")[1]}
          </Text>
        </View>
        {!isLast ? (
          <View
            style={{
              flex: 1,
              width: 2,
              borderRadius: radius.full,
              backgroundColor: theme.border,
            }}
          />
        ) : null}
      </View>

      <View
        style={[
          {
            flex: 1,
            padding: spacing.lg,
            borderRadius: radius.xl,
            backgroundColor: theme.surface.raised,
            borderWidth: 1,
            borderColor: theme.divider,
            gap: spacing.md,
            opacity: cancelled ? 0.6 : 1,
          },
          cancelled ? null : elevation(1, theme.shadow),
        ]}
      >
        <View style={{ gap: spacing.xs }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <MaterialCommunityIcons
              name="clock-outline"
              size={14}
              color={accent}
            />
            <Text style={[typography.label, { color: accent }]}>
              {relativeDay(start) + " · " + timeOfDay(start)}
            </Text>
            {cancelled ? (
              <Text style={[typography.caption, { color: theme.danger }]}>
                Annulé
              </Text>
            ) : null}
          </View>

          <Pressable onPress={onOpenSalon} accessibilityRole="link" hitSlop={4}>
            <Text
              style={[typography.h2, { color: theme.foreground.white }]}
              numberOfLines={1}
            >
              {salonNameFor(appointment)}
            </Text>
          </Pressable>

          <Text
            style={[typography.bodySmall, { color: theme.foreground.gray }]}
          >
            {serviceNameFor(appointment) +
              " · " +
              formatDuration(appointment.durationMin) +
              " · " +
              formatPrice(appointment.price)}
          </Text>

          {salon ? (
            <Text
              style={[typography.caption, { color: theme.foreground.gray }]}
            >
              {salon.addressLine + ", " + salon.city}
            </Text>
          ) : null}
        </View>

        {!cancelled ? (
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {upcoming ? (
              <>
                <TimelineAction
                  icon="calendar-edit"
                  label="Modifier"
                  onPress={onReschedule}
                  disabled={busy}
                />
                <TimelineAction
                  icon="close-circle-outline"
                  label="Annuler"
                  onPress={onCancel}
                  disabled={busy}
                  tone="danger"
                />
              </>
            ) : appointment.reviewId ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                }}
              >
                <MaterialCommunityIcons
                  name="star-check-outline"
                  size={16}
                  color={theme.success}
                />
                <Text style={[typography.caption, { color: theme.success }]}>
                  Avis envoyé
                </Text>
              </View>
            ) : (
              <TimelineAction
                icon="star-outline"
                label="Laisser un avis"
                onPress={onReview}
                disabled={busy}
              />
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function TimelineAction({
  icon,
  label,
  onPress,
  disabled,
  tone = "default",
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  const { theme } = useTheme();
  const color = tone === "danger" ? theme.danger : theme.primary.main;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        minHeight: 40,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: color,
        opacity: pressed || disabled ? 0.6 : 1,
      })}
    >
      <MaterialCommunityIcons name={icon} size={15} color={color} />
      <Text style={[typography.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
