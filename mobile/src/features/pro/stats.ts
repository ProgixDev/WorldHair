import { addDays, startOfDay } from "../../utils/date";
import type { AvailabilityDay, ProAppointment, ProService } from "./types";

/** Pure aggregations over the coiffeur's bookings — no React, no storage. */

export interface WeekBucket {
  /** Monday of the week. */
  start: Date;
  label: string;
  count: number;
  revenue: number;
}

/** Monday 00:00 of `date`'s week, local time. */
export function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  // getDay: 0 = Sunday. Shift so weeks start on Monday.
  const shift = (day.getDay() + 6) % 7;
  return addDays(day, -shift);
}

function isBillable(appointment: ProAppointment): boolean {
  return appointment.status === "done" || appointment.status === "confirmed";
}

/** What the booking brings in: what the client kept after refunds when they paid in the app, else its price. */
function earned(appointment: ProAppointment): number {
  return appointment.payment
    ? appointment.payment.amount - appointment.payment.refundedAmount
    : appointment.price;
}

/** Last `count` weeks, oldest first — feeds the dashboard bar chart. */
export function weeklySeries(
  appointments: ProAppointment[],
  count = 8,
  now = new Date(),
): WeekBucket[] {
  const currentWeek = startOfWeek(now);

  return Array.from({ length: count }, (_, index) => {
    const start = addDays(currentWeek, -7 * (count - 1 - index));
    const end = addDays(start, 7);
    const inWeek = appointments.filter((appointment) => {
      const date = new Date(appointment.startsAt);
      return isBillable(appointment) && date >= start && date < end;
    });

    return {
      start,
      label: start.getDate() + "/" + (start.getMonth() + 1),
      count: inWeek.length,
      revenue: inWeek.reduce((sum, a) => sum + earned(a), 0),
    };
  });
}

export interface ProStats {
  /** Confirmed bookings still to come. */
  upcoming: number;
  /** Requests waiting for a decision. */
  pending: number;
  bookingsThisWeek: number;
  bookingsLastWeek: number;
  /** Percentage change week over week; null when last week was empty. */
  weekTrend: number | null;
  revenueThisMonth: number;
  averageBasket: number;
  /** Accepted / (accepted + refused), as a percentage. */
  acceptanceRate: number;
  cancellations: number;
  /** Busiest weekday label, e.g. "samedi". */
  busiestWeekday: number | null;
  /** Each prestation counted on its own, even inside a multi-prestation booking. */
  topServices: { serviceId: string; name: string; count: number; revenue: number }[];
  /** Share of past appointments the coiffeur marked as missed, as a percentage; null before any. */
  noShowRate: number | null;
}

export function computeStats(
  appointments: ProAppointment[],
  now = new Date(),
): ProStats {
  const weeks = weeklySeries(appointments, 2, now);
  const thisWeek = weeks[1]?.count ?? 0;
  const lastWeek = weeks[0]?.count ?? 0;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const billed = appointments.filter(isBillable);

  const revenueThisMonth = billed
    .filter((a) => new Date(a.startsAt) >= monthStart)
    .reduce((sum, a) => sum + earned(a), 0);

  const done = appointments.filter((a) => a.status === "done");
  const refused = appointments.filter((a) => a.status === "refused").length;
  const accepted = appointments.filter(
    (a) => a.status === "confirmed" || a.status === "done",
  ).length;

  const weekdayCounts = new Map<number, number>();
  billed.forEach((appointment) => {
    const weekday = new Date(appointment.startsAt).getDay();
    weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + 1);
  });
  const busiest = [...weekdayCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const serviceTotals = new Map<
    string,
    { name: string; count: number; revenue: number }
  >();
  billed.forEach((appointment) => {
    const lines =
      appointment.services.length > 0
        ? appointment.services
        : [
            {
              serviceId: appointment.serviceId,
              name: "",
              price: appointment.price,
              durationMin: appointment.durationMin,
            },
          ];
    lines.forEach((line) => {
      const key = line.serviceId ?? line.name;
      const current = serviceTotals.get(key) ?? {
        name: line.name,
        count: 0,
        revenue: 0,
      };
      serviceTotals.set(key, {
        name: current.name || line.name,
        count: current.count + 1,
        revenue: current.revenue + line.price,
      });
    });
  });

  const noShows = done.filter((a) => a.attendance === "no_show").length;

  return {
    upcoming: appointments.filter(
      (a) => a.status === "confirmed" && new Date(a.startsAt) >= now,
    ).length,
    pending: appointments.filter((a) => a.status === "pending").length,
    bookingsThisWeek: thisWeek,
    bookingsLastWeek: lastWeek,
    weekTrend:
      lastWeek === 0
        ? null
        : Math.round(((thisWeek - lastWeek) / lastWeek) * 100),
    revenueThisMonth,
    averageBasket:
      done.length === 0
        ? 0
        : Math.round(done.reduce((sum, a) => sum + earned(a), 0) / done.length),
    acceptanceRate:
      accepted + refused === 0
        ? 100
        : Math.round((accepted / (accepted + refused)) * 100),
    cancellations: appointments.filter((a) => a.status === "cancelled").length,
    busiestWeekday: busiest ? busiest[0] : null,
    topServices: [...serviceTotals.entries()]
      .map(([serviceId, totals]) => ({ serviceId, ...totals }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4),
    noShowRate:
      done.length === 0 ? null : Math.round((noShows / done.length) * 100),
  };
}

/** Bookings for one day, chronological — the agenda column. */
export function appointmentsForDay(
  appointments: ProAppointment[],
  day: Date,
): ProAppointment[] {
  const start = startOfDay(day);
  const end = addDays(start, 1);
  return appointments
    .filter((appointment) => {
      const date = new Date(appointment.startsAt);
      return (
        date >= start &&
        date < end &&
        appointment.status !== "refused" &&
        appointment.status !== "cancelled"
      );
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export interface FillRate {
  bookedMinutes: number;
  openMinutes: number;
  /** 0-100, rounded. */
  percent: number;
}

const MINUTE_MS = 60_000;

/** Minutes of [from, to) the closures cover, each minute once however many closures overlap on it. */
function closedMinutes(closures: { startsAt: string; endsAt: string }[], from: number, to: number): number {
  const spans = closures
    .map((closure) => [Math.max(from, new Date(closure.startsAt).getTime()), Math.min(to, new Date(closure.endsAt).getTime())])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let reached = from;
  for (const [start, end] of spans) {
    const counted = Math.max(start, reached);
    if (end > counted) total += end - counted;
    reached = Math.max(reached, end);
  }
  return total / MINUTE_MS;
}

/**
 * "Taux de remplissage" (TODO.md Phase 6): how full this week (Monday to
 * Sunday) is — accepted bookings' minutes over the salon's open minutes,
 * lunch breaks and closures left out.
 */
export function weeklyFillRate(
  appointments: ProAppointment[],
  availability: AvailabilityDay[],
  closures: { startsAt: string; endsAt: string }[],
  now = new Date(),
): FillRate {
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);

  let openMinutes = 0;
  for (let offset = 0; offset < 7; offset += 1) {
    const day = addDays(weekStart, offset);
    const hours = availability.find((entry) => entry.weekday === day.getDay());
    if (!hours?.open) continue;
    const windows =
      hours.breakStart !== null && hours.breakEnd !== null
        ? [
            [hours.opens, hours.breakStart],
            [hours.breakEnd, hours.closes],
          ]
        : [[hours.opens, hours.closes]];
    for (const [from, to] of windows) {
      if (to <= from) continue;
      const start = day.getTime() + from * MINUTE_MS;
      const end = day.getTime() + to * MINUTE_MS;
      openMinutes += (end - start) / MINUTE_MS - closedMinutes(closures, start, end);
    }
  }

  const bookedMinutes = appointments
    .filter((appointment) => {
      const startsAt = new Date(appointment.startsAt);
      return isBillable(appointment) && startsAt >= weekStart && startsAt < weekEnd;
    })
    .reduce((sum, appointment) => sum + appointment.durationMin, 0);

  return {
    bookedMinutes,
    openMinutes: Math.round(openMinutes),
    percent: openMinutes <= 0 ? 0 : Math.min(100, Math.round((bookedMinutes / openMinutes) * 100)),
  };
}

/** How full a day is, as a percentage of its open minutes. */
export function occupancyForDay(
  appointments: ProAppointment[],
  day: Date,
  openMinutes: number,
): number {
  if (openMinutes <= 0) return 0;
  const booked = appointmentsForDay(appointments, day).reduce(
    (sum, appointment) => sum + appointment.durationMin,
    0,
  );
  return Math.min(100, Math.round((booked / openMinutes) * 100));
}

export function serviceName(services: ProService[], serviceId: string): string {
  return (
    services.find((service) => service.id === serviceId)?.name ?? "Prestation"
  );
}

/** Every prestation of a booking, by name — bookings made before several could be booked fall back to the catalogue. */
export function servicesLabel(appointment: ProAppointment, services: ProService[]): string {
  return appointment.services.length > 0
    ? appointment.services.map((line) => line.name).join(" + ")
    : serviceName(services, appointment.serviceId);
}
