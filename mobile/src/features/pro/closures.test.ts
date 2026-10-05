import { closureBlocksForDay, describeClosure, hoursRange, wholeDaysRange } from "./closures";

describe("closure ranges", () => {
  it("covers whole days from the first midnight to the midnight after the last day", () => {
    expect(wholeDaysRange(new Date(2026, 9, 6, 15, 0), new Date(2026, 9, 8, 9, 0))).toEqual({
      startsAt: new Date(2026, 9, 6).toISOString(),
      endsAt: new Date(2026, 9, 9).toISOString(),
    });
  });

  it("covers a few hours of one day", () => {
    expect(hoursRange(new Date(2026, 9, 6, 8, 0), 14 * 60, 19 * 60)).toEqual({
      startsAt: new Date(2026, 9, 6, 14, 0).toISOString(),
      endsAt: new Date(2026, 9, 6, 19, 0).toISOString(),
    });
  });
});

describe("describeClosure", () => {
  const closure = (startsAt: Date, endsAt: Date) => ({
    id: "t1",
    label: "",
    staffId: null,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  });

  it("names a single whole day", () => {
    expect(describeClosure(closure(new Date(2026, 9, 6), new Date(2026, 9, 7)))).toBe(
      "mar. 6 oct., toute la journée",
    );
  });

  it("names a run of whole days by its first and last day", () => {
    expect(describeClosure(closure(new Date(2026, 9, 6), new Date(2026, 9, 9)))).toBe(
      "du mar. 6 oct. au jeu. 8 oct.",
    );
  });

  it("names a few hours of one day", () => {
    expect(describeClosure(closure(new Date(2026, 9, 6, 14, 0), new Date(2026, 9, 6, 19, 0)))).toBe(
      "mar. 6 oct., 14:00–19:00",
    );
  });
});

describe("closureBlocksForDay", () => {
  it("places a block by the clock on the day the clocks change", () => {
    // 1 Nov 2026: clocks go back an hour at 2:00 in the tests' time zone (see jest.config.js).
    const blocks = closureBlocksForDay(
      [
        {
          id: "hours",
          label: "Formation",
          staffId: null,
          startsAt: new Date(2026, 10, 1, 14, 0).toISOString(),
          endsAt: new Date(2026, 10, 1, 16, 0).toISOString(),
        },
      ],
      new Date(2026, 10, 1),
    );
    expect(blocks).toEqual([{ startMinute: 14 * 60, endMinute: 16 * 60, label: "Formation" }]);
  });

  it("gives the closed minutes of that day, clipped to the day", () => {
    const blocks = closureBlocksForDay(
      [
        {
          id: "days",
          label: "Congés",
          staffId: null,
          startsAt: new Date(2026, 9, 5).toISOString(),
          endsAt: new Date(2026, 9, 8).toISOString(),
        },
        {
          id: "hours",
          label: "Formation",
          staffId: null,
          startsAt: new Date(2026, 9, 9, 14, 0).toISOString(),
          endsAt: new Date(2026, 9, 9, 19, 0).toISOString(),
        },
      ],
      new Date(2026, 9, 6),
    );
    expect(blocks).toEqual([{ startMinute: 0, endMinute: 1440, label: "Congés" }]);

    expect(
      closureBlocksForDay(
        [
          {
            id: "hours",
            label: "Formation",
            staffId: null,
            startsAt: new Date(2026, 9, 9, 14, 0).toISOString(),
            endsAt: new Date(2026, 9, 9, 19, 0).toISOString(),
          },
        ],
        new Date(2026, 9, 9),
      ),
    ).toEqual([{ startMinute: 840, endMinute: 1140, label: "Formation" }]);
  });
});
