import { bookingDays, dateKey } from "./slots";
import type { Salon } from "./types";

// Monday 28 September 2026, local time (the salon's own clock).
const MONDAY = new Date(2026, 8, 28, 8, 0);

function salon(overrides: Partial<Salon> = {}): Salon {
  return {
    id: "salon-1",
    // Open Monday to Saturday 9:00-19:00, closed on Sunday.
    hours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      opens: weekday === 0 ? null : 9 * 60,
      closes: weekday === 0 ? null : 19 * 60,
    })),
    closures: [],
    ...overrides,
  } as unknown as Salon;
}

describe("dateKey", () => {
  it("writes the local calendar day as YYYY-MM-DD", () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("bookingDays", () => {
  it("lists the next days the salon opens, skipping its weekly closed day", () => {
    const days = bookingDays(salon(), 7, MONDAY);

    expect(days.map((day) => dateKey(day.date))).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-05",
    ]);
    expect(days.every((day) => !day.closed)).toBe(true);
  });

  it("keeps a day covered by a closure in the strip, marked closed", () => {
    const days = bookingDays(
      salon({
        closures: [
          {
            startsAt: new Date(2026, 8, 30).toISOString(),
            endsAt: new Date(2026, 9, 1).toISOString(),
          },
        ],
      }),
      3,
      MONDAY,
    );

    expect(days.map((day) => [dateKey(day.date), day.closed])).toEqual([
      ["2026-09-28", false],
      ["2026-09-29", false],
      ["2026-09-30", true],
    ]);
  });

  it("leaves a day with only a few closed hours open — its slots show what's left", () => {
    const days = bookingDays(
      salon({
        closures: [
          {
            startsAt: new Date(2026, 8, 28, 14, 0).toISOString(),
            endsAt: new Date(2026, 8, 28, 19, 0).toISOString(),
          },
        ],
      }),
      1,
      MONDAY,
    );

    expect(days[0].closed).toBe(false);
  });
});
