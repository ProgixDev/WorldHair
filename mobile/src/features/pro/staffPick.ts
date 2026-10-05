import type { AvailabilityDay, StaffCandidate } from "./types";

/**
 * « Qui s'en occupe ? » (TODO.md Phase 3): who is ticked when the list
 * opens — the person the booking has (held when the client booked) when
 * they're still free, else the first one free; nobody when no one is.
 */
export function defaultPick(candidates: StaffCandidate[]): string | null {
  const free = candidates.filter((candidate) => candidate.free);
  return (free.find((candidate) => candidate.held) ?? free[0])?.staffId ?? null;
}

/** How a team member reads in the salon's own screens: the owner is « Moi ». */
export function staffLabel(person: { firstName: string; lastName: string; isOwner: boolean }): string {
  const name = `${person.firstName} ${person.lastName}`.trim() || "Sans nom";
  return person.isOwner ? `Moi (${name})` : name;
}

/** Whose booking it is: one without a person (from before teams) is the owner's, as the server counts it. */
export function personOf(appointment: { staffId: string | null }, ownerId: string | null): string | null {
  return appointment.staffId ?? ownerId;
}

/**
 * A person's day in the agenda: their own hours inside the salon's (a
 * booking must fit both), their own break if they set one; the salon's day
 * for someone on the salon's hours.
 */
export function personDay(
  salonDay: AvailabilityDay | undefined,
  personal: AvailabilityDay[] | null,
  weekday: number,
): AvailabilityDay | undefined {
  if (!salonDay || !personal) return salonDay;
  const own = personal.find((day) => day.weekday === weekday);
  const opens = Math.max(salonDay.opens, own?.opens ?? 0);
  const closes = Math.min(salonDay.closes, own?.closes ?? 0);
  if (!salonDay.open || !own?.open || opens >= closes) return { ...salonDay, open: false };
  const ownBreak = own.breakStart !== null && own.breakEnd !== null;
  return {
    weekday,
    open: true,
    opens,
    closes,
    breakStart: ownBreak ? own.breakStart : salonDay.breakStart,
    breakEnd: ownBreak ? own.breakEnd : salonDay.breakEnd,
  };
}
