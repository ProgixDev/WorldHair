import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import { closureBlocksForDay } from "../../features/pro/closures";
import type { AvailabilityDay, TimeOff } from "../../features/pro/types";
import { fetchSlots } from "../../features/salons/api";
import { dateKey, type DaySlots } from "../../features/salons/slots";
import { addDays, dayAndMonth, startOfDay, weekdayShort } from "../../utils/date";
import { Chip } from "../ui/Chip";

const DAYS_SHOWN = 21;

/**
 * Day chips and the server's slot grid for moving one appointment — the
 * same grid a client sees, except the salon itself isn't held to its own
 * booking notice (the server knows the caller is the coiffeur).
 */
export function SlotPicker({
  salonId,
  appointmentId,
  availability,
  timeOff,
  selected,
  onSelect,
  version = 0,
}: {
  salonId: string;
  appointmentId: string;
  availability: AvailabilityDay[];
  timeOff: TimeOff[];
  selected: string | null;
  onSelect: (startsAt: string) => void;
  /** Bump to fetch the grid again, e.g. after the picked time was taken meanwhile. */
  version?: number;
}) {
  const { theme } = useTheme();

  const days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: DAYS_SHOWN }, (_, offset) => addDays(today, offset))
      .map((date) => {
        const hours = availability.find((day) => day.weekday === date.getDay());
        if (!hours?.open) return null;
        const closed = closureBlocksForDay(timeOff, date).some(
          (block) => block.startMinute <= hours.opens && block.endMinute >= hours.closes,
        );
        return { date, closed };
      })
      .filter((day): day is { date: Date; closed: boolean } => day !== null);
  }, [availability, timeOff]);

  const [day, setDay] = useState<Date | null>(null);
  const [daySlots, setDaySlots] = useState<DaySlots | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!day && days.length > 0) setDay((days.find((d) => !d.closed) ?? days[0]).date);
  }, [day, days]);

  useEffect(() => {
    if (!day) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    fetchSlots(salonId, dateKey(day), { appointmentId })
      .then((result) => {
        if (!cancelled) setDaySlots(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [salonId, appointmentId, day, version]);

  return (
    <View style={{ gap: spacing.md }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
      >
        {days.map((candidate) => (
          <Chip
            key={candidate.date.toISOString()}
            label={
              weekdayShort(candidate.date) +
              " " +
              dayAndMonth(candidate.date) +
              (candidate.closed ? " · fermé" : "")
            }
            selected={day?.getTime() === candidate.date.getTime()}
            onPress={candidate.closed ? undefined : () => setDay(candidate.date)}
            readOnly={candidate.closed}
          />
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={theme.primary.main} />
      ) : failed ? (
        <Text style={[typography.bodySmall, { color: theme.danger }]}>
          Impossible de charger les créneaux. Réessayez.
        </Text>
      ) : !daySlots || daySlots.closed || daySlots.slots.every((slot) => !slot.available) ? (
        <Text style={[typography.bodySmall, { color: theme.foreground.gray }]}>
          Aucun créneau libre ce jour-là.
        </Text>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {daySlots.slots
            .filter((slot) => slot.available)
            .map((slot) => (
              <Chip
                key={slot.startsAt}
                label={slot.label}
                selected={selected === slot.startsAt}
                onPress={() => onSelect(slot.startsAt)}
              />
            ))}
        </View>
      )}
    </View>
  );
}
