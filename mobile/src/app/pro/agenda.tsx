import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { Button } from "../../components/ui/Button";
import { elevation, TAB_BAR_CLEARANCE } from "../../constants/elevation";
import { useResponsive } from "../../constants/responsive";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { usePro } from "../../contexts/ProContext";
import { useTheme } from "../../contexts/ThemeContext";
import {
  appointmentsForDay,
  occupancyForDay,
  serviceName,
} from "../../features/pro/stats";
import type { AvailabilityDay, ProAppointment } from "../../features/pro/types";
import { avatarFor } from "../../features/salons/images";
import {
  addDays,
  dayAndMonth,
  formatDuration,
  formatPrice,
  isSameDay,
  minutesToTime,
  relativeDay,
  startOfDay,
  timeOfDay,
  weekdayLong,
  weekdayShort,
} from "../../utils/date";

const PX_PER_MIN = 1.15;
const STEP = 30;

/**
 * Agenda: pending requests first, then a real day column where each booking is
 * a block sized by its duration. Availability is edited in a sheet.
 */
export default function ProAgenda() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();
  const {
    appointments,
    services,
    availability,
    saveAvailability,
    setAppointmentStatus,
  } = usePro();

  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [draft, setDraft] = useState<AvailabilityDay[]>([]);

  const days = useMemo(
    () => Array.from({ length: 14 }, (_, index) => addDays(new Date(), index)),
    [],
  );

  const pending = useMemo(
    () =>
      appointments
        .filter((appointment) => appointment.status === "pending")
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [appointments],
  );

  const dayConfig = availability.find(
    (day) => day.weekday === selectedDay.getDay(),
  );
  const dayAppointments = useMemo(
    () => appointmentsForDay(appointments, selectedDay),
    [appointments, selectedDay],
  );
  const openMinutes = dayConfig?.open ? dayConfig.closes - dayConfig.opens : 0;
  const occupancy = occupancyForDay(appointments, selectedDay, openMinutes);

  const decide = async (
    appointment: ProAppointment,
    status: "confirmed" | "refused",
  ) => {
    setBusyId(appointment.id);
    try {
      await setAppointmentStatus(appointment.id, status);
    } finally {
      setBusyId(null);
    }
  };

  const cancelBooking = (appointment: ProAppointment) => {
    Alert.alert(
      "Annuler ce rendez-vous ?",
      appointment.clientName +
        " sera notifié de l'annulation. Cette action est irréversible.",
      [
        { text: "Garder", style: "cancel" },
        {
          text: "Annuler le RDV",
          style: "destructive",
          onPress: () => void setAppointmentStatus(appointment.id, "cancelled"),
        },
      ],
    );
  };

  /**
   * Opens the availability sheet. `forceOpenWeekday` pre-toggles that one day
   * on in the draft, so the "Ouvrir ce jour" shortcut actually opens the day
   * it names rather than just landing on the generic settings list.
   */
  const openHours = (forceOpenWeekday?: number) => {
    setDraft(
      availability.map((day) =>
        day.weekday === forceOpenWeekday ? { ...day, open: true } : { ...day },
      ),
    );
    setHoursOpen(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background.dark }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom:
            Math.max(insets.bottom, spacing.md) + TAB_BAR_CLEARANCE,
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            paddingHorizontal: gutter,
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: spacing.md,
          }}
        >
          <Text
            style={[typography.display, { color: theme.foreground.white }]}
            accessibilityRole="header"
          >
            Agenda
          </Text>
          <Pressable
            onPress={() => openHours()}
            accessibilityRole="button"
            accessibilityLabel="Modifier mes disponibilités"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: theme.primary.main,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <MaterialCommunityIcons
              name="clock-edit-outline"
              size={15}
              color={theme.primary.main}
            />
            <Text style={[typography.label, { color: theme.primary.main }]}>
              Horaires
            </Text>
          </Pressable>
        </View>

        {/* ── Requests ─────────────────────────────────────────────────── */}
        {pending.length > 0 ? (
          <View style={{ gap: spacing.md, paddingHorizontal: gutter }}>
            <Text style={[typography.overline, { color: theme.danger }]}>
              {pending.length +
                (pending.length > 1 ? " DEMANDES" : " DEMANDE") +
                " À TRAITER"}
            </Text>

            {pending.map((appointment) => (
              <View
                key={appointment.id}
                style={[
                  {
                    padding: spacing.lg,
                    borderRadius: radius.xl,
                    backgroundColor: theme.surface.raised,
                    borderWidth: 1.5,
                    borderColor: theme.danger,
                    gap: spacing.md,
                  },
                  elevation(2, theme.shadow),
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  }}
                >
                  <Image
                    source={avatarFor(appointment.clientId)}
                    cachePolicy="memory-disk"
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: radius.full,
                      backgroundColor: theme.surface.sunken,
                    }}
                    contentFit="cover"
                    transition={200}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.sm,
                      }}
                    >
                      <Text
                        style={[
                          typography.bodyMedium,
                          { color: theme.foreground.white },
                        ]}
                        numberOfLines={1}
                      >
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
                          <Text
                            style={[
                              typography.caption,
                              { color: theme.primary.main, fontSize: 10 },
                            ]}
                          >
                            Nouveau
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        typography.caption,
                        { color: theme.foreground.gray },
                      ]}
                    >
                      {relativeDay(new Date(appointment.startsAt)) +
                        " · " +
                        timeOfDay(new Date(appointment.startsAt)) +
                        " · " +
                        formatDuration(appointment.durationMin)}
                    </Text>
                  </View>
                  <Text style={[typography.h2, { color: theme.accent.warm }]}>
                    {formatPrice(appointment.price)}
                  </Text>
                </View>

                <Text
                  style={[
                    typography.bodySmall,
                    { color: theme.foreground.white },
                  ]}
                >
                  {serviceName(services, appointment.serviceId)}
                </Text>

                {appointment.note ? (
                  <View
                    style={{
                      padding: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: theme.surface.base,
                    }}
                  >
                    <Text
                      style={[
                        typography.caption,
                        { color: theme.foreground.gray },
                      ]}
                    >
                      {"« " + appointment.note + " »"}
                    </Text>
                  </View>
                ) : null}

                <View style={{ flexDirection: "row", gap: spacing.md }}>
                  <Button
                    label="Refuser"
                    variant="outline"
                    background={theme.danger}
                    color={theme.danger}
                    onPress={() => void decide(appointment, "refused")}
                    disabled={busyId === appointment.id}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Accepter"
                    onPress={() => void decide(appointment, "confirmed")}
                    loading={busyId === appointment.id}
                    background={theme.primary.main}
                    color={theme.primary.on}
                    style={{ flex: 1.3 }}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* ── Day strip ────────────────────────────────────────────────── */}
        <View style={{ gap: spacing.md }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: gutter,
              gap: spacing.sm,
            }}
          >
            {days.map((day) => {
              const selected = isSameDay(day, selectedDay);
              const config = availability.find(
                (item) => item.weekday === day.getDay(),
              );
              const count = appointmentsForDay(appointments, day).length;

              return (
                <Pressable
                  key={day.toISOString()}
                  onPress={() => setSelectedDay(startOfDay(day))}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={weekdayLong(day) + " " + dayAndMonth(day)}
                  style={{
                    width: 62,
                    paddingVertical: spacing.md,
                    borderRadius: radius.lg,
                    alignItems: "center",
                    gap: 3,
                    backgroundColor: selected
                      ? theme.primary.main
                      : theme.surface.raised,
                    borderWidth: 1.5,
                    borderColor: selected ? theme.primary.main : theme.divider,
                    opacity: config?.open ? 1 : 0.5,
                  }}
                >
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: selected
                          ? theme.primary.on
                          : theme.foreground.gray,
                      },
                    ]}
                  >
                    {weekdayShort(day)}
                  </Text>
                  <Text
                    style={[
                      typography.bodyMedium,
                      {
                        color: selected
                          ? theme.primary.on
                          : theme.foreground.white,
                      },
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 2,
                      minHeight: 5,
                      alignItems: "center",
                    }}
                  >
                    {Array.from({ length: Math.min(count, 3) }, (_, dot) => (
                      <View
                        key={dot}
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: selected
                            ? theme.primary.on
                            : theme.primary.main,
                        }}
                      />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View
            style={{
              paddingHorizontal: gutter,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={[typography.label, { color: theme.foreground.white }]}>
              {relativeDay(selectedDay) +
                (dayConfig?.open
                  ? " · " +
                    minutesToTime(dayConfig.opens) +
                    "–" +
                    minutesToTime(dayConfig.closes)
                  : " · fermé")}
            </Text>
            {dayConfig?.open ? (
              <Text
                style={[typography.caption, { color: theme.foreground.gray }]}
              >
                {"Remplissage " + occupancy + " %"}
              </Text>
            ) : null}
          </View>
        </View>

        {/* ── Day column ───────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: gutter }}>
          {!dayConfig?.open ? (
            <View
              style={{
                padding: spacing.xl,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: theme.border,
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <MaterialCommunityIcons
                name="store-clock-outline"
                size={28}
                color={theme.foreground.gray}
              />
              <Text
                style={[
                  typography.bodySmall,
                  { color: theme.foreground.gray, textAlign: "center" },
                ]}
              >
                Salon fermé ce jour-là.
              </Text>
              <Button
                label="Ouvrir ce jour"
                variant="outline"
                onPress={() => openHours(selectedDay.getDay())}
              />
            </View>
          ) : (
            <DayColumn
              config={dayConfig}
              appointments={dayAppointments}
              serviceLabel={(id) => serviceName(services, id)}
              onCancel={cancelBooking}
            />
          )}
        </View>
      </ScrollView>

      {/* ── Availability sheet ─────────────────────────────────────────── */}
      <BottomSheet
        visible={hoursOpen}
        title="Mes disponibilités"
        onClose={() => setHoursOpen(false)}
        footer={
          <>
            <Button
              label="Annuler"
              variant="outline"
              onPress={() => setHoursOpen(false)}
              style={{ flex: 1 }}
            />
            <Button
              label="Enregistrer"
              onPress={() => {
                void saveAvailability(draft);
                setHoursOpen(false);
              }}
              background={theme.primary.main}
              color={theme.primary.on}
              style={{ flex: 1.3 }}
            />
          </>
        }
      >
        {draft.map((day, index) => (
          <AvailabilityRow
            key={day.weekday}
            day={day}
            onChange={(next) =>
              setDraft((current) =>
                current.map((item, i) => (i === index ? next : item)),
              )
            }
          />
        ))}
      </BottomSheet>
    </View>
  );
}

/** Time rail with each booking drawn as a block proportional to its duration. */
function DayColumn({
  config,
  appointments,
  serviceLabel,
  onCancel,
}: {
  config: AvailabilityDay;
  appointments: ProAppointment[];
  serviceLabel: (serviceId: string) => string;
  onCancel: (appointment: ProAppointment) => void;
}) {
  const { theme } = useTheme();
  const height = (config.closes - config.opens) * PX_PER_MIN;
  const hours: number[] = [];
  for (
    let minutes = Math.ceil(config.opens / 60) * 60;
    minutes <= config.closes;
    minutes += 60
  )
    hours.push(minutes);

  return (
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      {/* Hour rail */}
      <View style={{ width: 44, height }}>
        {hours.map((minutes) => (
          <Text
            key={minutes}
            style={[
              typography.caption,
              {
                position: "absolute",
                top: (minutes - config.opens) * PX_PER_MIN - 7,
                color: theme.foreground.gray,
                fontSize: 11,
              },
            ]}
          >
            {minutesToTime(minutes)}
          </Text>
        ))}
      </View>

      <View
        style={{
          flex: 1,
          height,
          borderRadius: radius.lg,
          backgroundColor: theme.surface.base,
          borderWidth: 1,
          borderColor: theme.divider,
          overflow: "hidden",
        }}
      >
        {/* Hour lines */}
        {hours.map((minutes) => (
          <View
            key={minutes}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: (minutes - config.opens) * PX_PER_MIN,
              height: 1,
              backgroundColor: theme.divider,
            }}
          />
        ))}

        {/* Lunch break */}
        {config.breakStart !== null && config.breakEnd !== null ? (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: (config.breakStart - config.opens) * PX_PER_MIN,
              height: (config.breakEnd - config.breakStart) * PX_PER_MIN,
              backgroundColor: theme.surface.sunken,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={[
                typography.caption,
                { color: theme.foreground.gray, fontSize: 10 },
              ]}
            >
              PAUSE
            </Text>
          </View>
        ) : null}

        {/* Bookings */}
        {appointments.map((appointment) => {
          const start = new Date(appointment.startsAt);
          const startMinutes = start.getHours() * 60 + start.getMinutes();
          const top = (startMinutes - config.opens) * PX_PER_MIN;
          const blockHeight = Math.max(
            34,
            appointment.durationMin * PX_PER_MIN - 3,
          );
          const isPending = appointment.status === "pending";

          return (
            <Pressable
              key={appointment.id}
              onLongPress={() => onCancel(appointment)}
              accessibilityRole="button"
              accessibilityLabel={
                appointment.clientName +
                ", " +
                timeOfDay(start) +
                ". Appui long pour annuler."
              }
              style={({ pressed }) => ({
                position: "absolute",
                left: spacing.sm,
                right: spacing.sm,
                top: Math.max(0, top),
                height: blockHeight,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                justifyContent: "center",
                gap: 2,
                backgroundColor: isPending
                  ? theme.surface.raised
                  : theme.primary.soft,
                borderWidth: 1.5,
                borderStyle: isPending ? "dashed" : "solid",
                borderColor: isPending ? theme.danger : theme.primary.main,
                // A tap alone does nothing here (only long-press cancels), so
                // it still needs to visibly react — otherwise the block reads
                // as unresponsive rather than "hold to cancel".
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                style={[typography.label, { color: theme.foreground.white }]}
                numberOfLines={1}
              >
                {timeOfDay(start) + " · " + appointment.clientName}
              </Text>
              {blockHeight > 44 ? (
                <Text
                  style={[typography.caption, { color: theme.foreground.gray }]}
                  numberOfLines={1}
                >
                  {serviceLabel(appointment.serviceId) +
                    " · " +
                    formatPrice(appointment.price)}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function AvailabilityRow({
  day,
  onChange,
}: {
  day: AvailabilityDay;
  onChange: (day: AvailabilityDay) => void;
}) {
  const { theme } = useTheme();
  const reference = new Date(2026, 7, 16 + day.weekday); // any week works

  return (
    <View
      style={{
        padding: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: theme.surface.base,
        borderWidth: 1,
        borderColor: theme.divider,
        gap: spacing.md,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={[typography.bodyMedium, { color: theme.foreground.white }]}
        >
          {weekdayLong(reference)}
        </Text>
        <Switch
          value={day.open}
          onValueChange={(open) => onChange({ ...day, open })}
          accessibilityLabel={"Ouvrir le " + weekdayLong(reference)}
          trackColor={{ false: theme.surface.sunken, true: theme.primary.main }}
          thumbColor={day.open ? theme.primary.on : theme.foreground.gray}
        />
      </View>

      {day.open ? (
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <TimeStepper
            label="Ouverture"
            value={day.opens}
            onChange={(opens) =>
              onChange({ ...day, opens: Math.min(opens, day.closes - 60) })
            }
          />
          <TimeStepper
            label="Fermeture"
            value={day.closes}
            onChange={(closes) =>
              onChange({ ...day, closes: Math.max(closes, day.opens + 60) })
            }
          />
        </View>
      ) : null}
    </View>
  );
}

function TimeStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const { theme } = useTheme();

  return (
    <View style={{ flex: 1, gap: spacing.xs }}>
      <Text style={[typography.caption, { color: theme.foreground.gray }]}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.sm,
          minHeight: 44,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: theme.border,
        }}
      >
        <Pressable
          onPress={() => onChange(Math.max(0, value - STEP))}
          accessibilityRole="button"
          accessibilityLabel={label + " moins 30 minutes"}
          hitSlop={6}
        >
          <MaterialCommunityIcons
            name="minus"
            size={18}
            color={theme.primary.main}
          />
        </Pressable>
        <Text style={[typography.label, { color: theme.foreground.white }]}>
          {minutesToTime(value)}
        </Text>
        <Pressable
          onPress={() => onChange(Math.min(24 * 60 - STEP, value + STEP))}
          accessibilityRole="button"
          accessibilityLabel={label + " plus 30 minutes"}
          hitSlop={6}
        >
          <MaterialCommunityIcons
            name="plus"
            size={18}
            color={theme.primary.main}
          />
        </Pressable>
      </View>
    </View>
  );
}
