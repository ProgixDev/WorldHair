import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppointmentSheet } from "../../components/pro/AppointmentSheet";
import { AvailabilityRow } from "../../components/pro/AvailabilityEditor";
import { ClosuresSheet } from "../../components/pro/ClosuresSheet";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { Button } from "../../components/ui/Button";
import { elevation, TAB_BAR_CLEARANCE } from "../../constants/elevation";
import { useResponsive } from "../../constants/responsive";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { usePro } from "../../contexts/ProContext";
import { useTheme } from "../../contexts/ThemeContext";
import { closureBlocksForDay } from "../../features/pro/closures";
import {
  appointmentsForDay,
  occupancyForDay,
  servicesLabel,
} from "../../features/pro/stats";
import type { Attendance, AvailabilityDay, ProAppointment } from "../../features/pro/types";
import { proErrorMessage } from "../../services/pro";
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
/** How far back past appointments stay in "À marquer" until marked. */
const MARKING_WINDOW_DAYS = 14;

/**
 * Agenda: pending requests first, then past appointments still to mark
 * (attended or missed), then a real day column where each booking is a
 * block sized by its duration — tap one for its details and actions.
 * Hours and closures are edited in sheets.
 */
export default function ProAgenda() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();
  const {
    appointments,
    services,
    availability,
    timeOff,
    saveAvailability,
    setAppointmentStatus,
    setAttendance,
  } = usePro();

  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [closuresOpen, setClosuresOpen] = useState(false);
  const [draft, setDraft] = useState<AvailabilityDay[]>([]);
  const [sheetAppointment, setSheetAppointment] = useState<ProAppointment | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const openAppointment = (appointment: ProAppointment) => {
    setSheetAppointment(appointment);
    setSheetVisible(true);
  };
  // The sheet follows the live list, so a mark or a move shows in it at once.
  const liveSheetAppointment = useMemo(
    () =>
      sheetAppointment
        ? (appointments.find((appointment) => appointment.id === sheetAppointment.id) ?? sheetAppointment)
        : null,
    [appointments, sheetAppointment],
  );

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

  // Past appointments nobody has marked yet — "Honoré" or "Absent".
  const toMark = useMemo(() => {
    const since = addDays(new Date(), -MARKING_WINDOW_DAYS).getTime();
    const now = Date.now();
    return appointments
      .filter((appointment) => {
        const start = new Date(appointment.startsAt).getTime();
        return (
          (appointment.status === "done" || appointment.status === "confirmed") &&
          appointment.attendance === null &&
          start <= now &&
          start >= since
        );
      })
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
      .slice(0, 5);
  }, [appointments]);

  const dayConfig = availability.find(
    (day) => day.weekday === selectedDay.getDay(),
  );
  const dayAppointments = useMemo(
    () => appointmentsForDay(appointments, selectedDay),
    [appointments, selectedDay],
  );
  const dayClosures = useMemo(
    () => closureBlocksForDay(timeOff, selectedDay),
    [timeOff, selectedDay],
  );
  const closedAllDay =
    dayConfig?.open === true &&
    dayClosures.some(
      (block) =>
        block.startMinute <= dayConfig.opens && block.endMinute >= dayConfig.closes,
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
    } catch (err) {
      Alert.alert("Action impossible", proErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const mark = async (appointment: ProAppointment, attendance: Attendance) => {
    setBusyId(appointment.id);
    try {
      await setAttendance(appointment.id, attendance);
    } catch (err) {
      Alert.alert("Action impossible", proErrorMessage(err));
    } finally {
      setBusyId(null);
    }
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
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <HeaderAction
              icon="calendar-remove-outline"
              label="Fermetures"
              accessibilityLabel="Congés et fermetures"
              onPress={() => setClosuresOpen(true)}
            />
            <HeaderAction
              icon="clock-edit-outline"
              label="Horaires"
              accessibilityLabel="Modifier mes disponibilités"
              onPress={() => openHours()}
            />
          </View>
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
                    source={avatarFor(appointment.clientId ?? appointment.id)}
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
                  {servicesLabel(appointment, services)}
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

        {/* ── Past appointments to mark ────────────────────────────────── */}
        {toMark.length > 0 ? (
          <View style={{ gap: spacing.md, paddingHorizontal: gutter }}>
            <Text style={[typography.overline, { color: theme.foreground.gray }]}>
              LE CLIENT EST-IL VENU ?
            </Text>
            {toMark.map((appointment) => {
              const start = new Date(appointment.startsAt);
              return (
                <View
                  key={appointment.id}
                  style={{
                    padding: spacing.lg,
                    borderRadius: radius.xl,
                    backgroundColor: theme.surface.raised,
                    borderWidth: 1,
                    borderColor: theme.divider,
                    gap: spacing.md,
                  }}
                >
                  <Pressable
                    onPress={() => openAppointment(appointment)}
                    accessibilityRole="button"
                    style={{ gap: 2 }}
                  >
                    <Text style={[typography.bodyMedium, { color: theme.foreground.white }]}>
                      {appointment.clientName}
                    </Text>
                    <Text style={[typography.caption, { color: theme.foreground.gray }]}>
                      {relativeDay(start) +
                        " · " +
                        timeOfDay(start) +
                        " · " +
                        servicesLabel(appointment, services)}
                    </Text>
                  </Pressable>
                  <View style={{ flexDirection: "row", gap: spacing.md }}>
                    <Button
                      label="Absent"
                      variant="outline"
                      background={theme.danger}
                      color={theme.danger}
                      onPress={() => void mark(appointment, "no_show")}
                      disabled={busyId === appointment.id}
                      style={{ flex: 1 }}
                    />
                    <Button
                      label="Honoré"
                      onPress={() => void mark(appointment, "attended")}
                      loading={busyId === appointment.id}
                      background={theme.primary.main}
                      color={theme.primary.on}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              );
            })}
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
                (dayConfig?.open && !closedAllDay
                  ? " · " +
                    minutesToTime(dayConfig.opens) +
                    "–" +
                    minutesToTime(dayConfig.closes)
                  : " · fermé")}
            </Text>
            {dayConfig?.open && !closedAllDay ? (
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
            <>
              {closedAllDay ? (
                <Pressable
                  onPress={() => setClosuresOpen(true)}
                  accessibilityRole="button"
                  style={{
                    marginBottom: spacing.md,
                    padding: spacing.md,
                    borderRadius: radius.lg,
                    backgroundColor: theme.surface.sunken,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                  }}
                >
                  <MaterialCommunityIcons
                    name="calendar-remove-outline"
                    size={18}
                    color={theme.foreground.gray}
                  />
                  <Text style={[typography.bodySmall, { color: theme.foreground.gray, flex: 1 }]}>
                    {"Fermé ce jour-là" +
                      (dayClosures[0]?.label ? " · " + dayClosures[0].label : "") +
                      ". Aucune réservation possible."}
                  </Text>
                </Pressable>
              ) : null}
              <DayColumn
                config={dayConfig}
                appointments={dayAppointments}
                closures={dayClosures}
                serviceLabel={(appointment) =>
                  servicesLabel(appointment, services)
                }
                onOpen={openAppointment}
              />
            </>
          )}
        </View>
      </ScrollView>

      <AppointmentSheet
        appointment={liveSheetAppointment}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
      />

      <ClosuresSheet visible={closuresOpen} onClose={() => setClosuresOpen(false)} />

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

function HeaderAction({
  icon,
  label,
  accessibilityLabel,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
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
      <MaterialCommunityIcons name={icon} size={15} color={theme.primary.main} />
      <Text style={[typography.label, { color: theme.primary.main }]}>{label}</Text>
    </Pressable>
  );
}

/** Time rail with each booking drawn as a block proportional to its duration, and closures greyed over it. */
function DayColumn({
  config,
  appointments,
  closures,
  serviceLabel,
  onOpen,
}: {
  config: AvailabilityDay;
  appointments: ProAppointment[];
  /** Closed stretches of this day, minutes from midnight. */
  closures: { startMinute: number; endMinute: number; label: string }[];
  serviceLabel: (appointment: ProAppointment) => string;
  onOpen: (appointment: ProAppointment) => void;
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

        {/* Closures (congés, fermetures), clipped to the opening hours */}
        {closures.map((block, index) => {
          const from = Math.max(block.startMinute, config.opens);
          const to = Math.min(block.endMinute, config.closes);
          if (to <= from) return null;
          return (
            <View
              key={index}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: (from - config.opens) * PX_PER_MIN,
                height: (to - from) * PX_PER_MIN,
                backgroundColor: theme.surface.sunken,
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderStyle: "dashed",
                borderColor: theme.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={[typography.caption, { color: theme.foreground.gray, fontSize: 10 }]}>
                {"FERMÉ" + (block.label ? " · " + block.label.toUpperCase() : "")}
              </Text>
            </View>
          );
        })}

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
              onPress={() => onOpen(appointment)}
              onLongPress={() => onOpen(appointment)}
              accessibilityRole="button"
              accessibilityLabel={
                appointment.clientName +
                ", " +
                timeOfDay(start) +
                ". Touchez pour voir le détail, déplacer ou annuler."
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
                  style={[
                    typography.caption,
                    {
                      color: isPending
                        ? theme.foreground.gray
                        : theme.foreground.white,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {serviceLabel(appointment) +
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
