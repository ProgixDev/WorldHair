import { slotsForDay } from "./slots";
import type { Salon } from "./types";

// Wednesday 30 September 2026, local time (the salon's own clock).
const DAY = new Date(2026, 8, 30);
const EARLIER_THAT_WEEK = new Date(2026, 8, 28, 8, 0);

function salonOpen(
  opens: number,
  closes: number,
  lunch?: { start: number; end: number },
): Salon {
  return {
    id: "salon-1",
    hours: [
      {
        weekday: DAY.getDay(),
        opens,
        closes,
        breakStart: lunch?.start ?? null,
        breakEnd: lunch?.end ?? null,
      },
    ],
  } as unknown as Salon;
}

function at(hour: number, minute = 0): string {
  return new Date(2026, 8, 30, hour, minute).toISOString();
}

function available(slots: { label: string; available: boolean }[]): string[] {
  return slots.filter((slot) => slot.available).map((slot) => slot.label);
}

describe("slotsForDay", () => {
  it("offers every half hour from opening to the last start that still fits", () => {
    const slots = slotsForDay({
      salon: salonOpen(9 * 60, 12 * 60),
      day: DAY,
      durationMin: 60,
      now: EARLIER_THAT_WEEK,
    });

    expect(slots.map((slot) => slot.label)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
  });

  it("never invents busy slots: with no booking, every slot is free", () => {
    const slots = slotsForDay({
      salon: salonOpen(9 * 60, 19 * 60),
      day: DAY,
      durationMin: 30,
      busy: [],
      now: EARLIER_THAT_WEEK,
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((slot) => slot.available)).toBe(true);
  });

  it("blocks every start that would overlap a booking, not only its exact start", () => {
    const slots = slotsForDay({
      salon: salonOpen(9 * 60, 12 * 60),
      day: DAY,
      durationMin: 60,
      busy: [{ startsAt: at(10), durationMin: 60 }],
      now: EARLIER_THAT_WEEK,
    });

    expect(available(slots)).toEqual(["09:00", "11:00"]);
  });

  it("keeps the lunch break free", () => {
    const slots = slotsForDay({
      salon: salonOpen(9 * 60, 15 * 60, { start: 12 * 60, end: 13 * 60 }),
      day: DAY,
      durationMin: 60,
      now: EARLIER_THAT_WEEK,
    });

    expect(available(slots)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "13:00", "13:30", "14:00"]);
  });

  it("blocks starts that have already passed today", () => {
    const slots = slotsForDay({
      salon: salonOpen(9 * 60, 12 * 60),
      day: DAY,
      durationMin: 30,
      now: new Date(2026, 8, 30, 10, 15),
    });

    expect(available(slots)).toEqual(["10:30", "11:00", "11:30"]);
  });

  it("has nothing to offer on a closed day", () => {
    const closed = {
      id: "salon-1",
      hours: [{ weekday: DAY.getDay(), opens: null, closes: null }],
    } as unknown as Salon;

    expect(slotsForDay({ salon: closed, day: DAY, durationMin: 30, now: EARLIER_THAT_WEEK })).toEqual([]);
  });
});
