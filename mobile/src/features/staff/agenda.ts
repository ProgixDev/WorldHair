import type { ProAppointment } from "../pro/types";
import { addDays, isSameDay, startOfDay, timeOfDay } from "../../utils/date";

/** How far back « Passés » goes — enough to mark last month's honoré/absent. */
export const PAST_WINDOW_DAYS = 30;

export interface StaffAgendaSections {
  today: ProAppointment[];
  upcoming: ProAppointment[];
  /** Most recent first. */
  past: ProAppointment[];
}

/** The server only sends accepted bookings; a list refreshed mid-change may still hold another one. */
function isAccepted(appointment: ProAppointment): boolean {
  return appointment.status === "confirmed" || appointment.status === "done";
}

/** A staff member's agenda, read-only (TODO.md Phase 3): « Aujourd'hui », « À venir », « Passés ». */
export function staffAgendaSections(appointments: ProAppointment[], now = new Date()): StaffAgendaSections {
  const todayStart = startOfDay(now).getTime();
  const tomorrowStart = startOfDay(addDays(now, 1)).getTime();
  const pastSince = startOfDay(addDays(now, -PAST_WINDOW_DAYS)).getTime();

  const sections: StaffAgendaSections = { today: [], upcoming: [], past: [] };
  for (const appointment of appointments) {
    if (!isAccepted(appointment)) continue;
    const start = new Date(appointment.startsAt);
    const time = start.getTime();
    if (isSameDay(start, now)) sections.today.push(appointment);
    else if (time >= tomorrowStart) sections.upcoming.push(appointment);
    else if (time < todayStart && time >= pastSince) sections.past.push(appointment);
  }

  sections.today.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  sections.upcoming.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  sections.past.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return sections;
}

/** « Honoré » / « Absent »: once the booking has started, until someone marks it (the server refuses earlier). */
export function canMarkAttendance(appointment: ProAppointment, now = new Date()): boolean {
  return (
    isAccepted(appointment) &&
    appointment.attendance === null &&
    new Date(appointment.startsAt).getTime() <= now.getTime()
  );
}

/** "14:30 – 15:15" */
export function timeRange(appointment: ProAppointment): string {
  const start = new Date(appointment.startsAt);
  const end = new Date(start.getTime() + appointment.durationMin * 60_000);
  return timeOfDay(start) + " – " + timeOfDay(end);
}
