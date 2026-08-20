import { addDays, startOfDay } from "../../utils/date";
import type { ProAppointment, ProService } from "./types";

/** Pure aggregations over the coiffeur's bookings — no React, no storage. */

export interface WeekBucket {
  /** Monday of the week. */
  start: Date;
  label: string;
  count: number;
  revenue: number;
}

function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  // getDay: 0 = Sunday. Shift so weeks start on Monday.
  const shift = (day.getDay() + 6) % 7;
  return addDays(day, -shift);
}

function isBillable(appointment: ProAppointment): boolean {
  return appointment.status === "done" || appointment.status === "confirmed";
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
      revenue: inWeek.reduce((sum, a) => sum + a.price, 0),
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
  topServices: { serviceId: string; count: number; revenue: number }[];
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
    .reduce((sum, a) => sum + a.price, 0);

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

  const serviceTotals = new Map<string, { count: number; revenue: number }>();
  billed.forEach((appointment) => {
    const current = serviceTotals.get(appointment.serviceId) ?? {
      count: 0,
      revenue: 0,
    };
    serviceTotals.set(appointment.serviceId, {
      count: current.count + 1,
      revenue: current.revenue + appointment.price,
    });
  });

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
        : Math.round(done.reduce((sum, a) => sum + a.price, 0) / done.length),
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
