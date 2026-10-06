import { computeStats, weeklyFillRate } from "./stats";
import type { AvailabilityDay, ProAppointment } from "./types";

const NOW = new Date(2026, 8, 30, 12, 0);

function appointment(overrides: Partial<ProAppointment>): ProAppointment {
  return {
    id: Math.random().toString(36),
    serviceId: "cut",
    clientName: "Camille D.",
    clientId: "c1",
    startsAt: new Date(2026, 8, 20, 10, 0).toISOString(),
    durationMin: 60,
    price: 40,
    services: [{ serviceId: "cut", name: "Coupe", price: 40, durationMin: 60 }],
    status: "done",
    attendance: null,
    isNewClient: false,
    payment: null,
    staffId: null,
    staffName: null,
    confirmedByClientAt: null,
    ...overrides,
  };
}

describe("computeStats", () => {
  it("counts what clients actually kept when they paid in the app", () => {
    const stats = computeStats(
      [
        appointment({
          price: 40,
          payment: { amount: 40, refundedAmount: 15, commissionAmount: 2.5, payoutAmount: 22.5, paidOutAt: null },
        }),
        appointment({ price: 30 }),
      ],
      NOW,
    );

    expect(stats.revenueThisMonth).toBe(55);
    expect(stats.averageBasket).toBe(28);
  });

  it("counts every prestation of a multi-prestation booking in the top services", () => {
    const stats = computeStats(
      [
        appointment({
          serviceId: "color",
          price: 95,
          services: [
            { serviceId: "color", name: "Couleur", price: 55, durationMin: 90 },
            { serviceId: "cut", name: "Coupe", price: 40, durationMin: 60 },
          ],
        }),
        appointment({}),
      ],
      NOW,
    );

    expect(stats.topServices).toEqual([
      { serviceId: "cut", name: "Coupe", count: 2, revenue: 80 },
      { serviceId: "color", name: "Couleur", count: 1, revenue: 55 },
    ]);
  });

  it("gives the share of past appointments marked as no-shows", () => {
    const stats = computeStats(
      [
        appointment({ attendance: "no_show" }),
        appointment({ attendance: "attended" }),
        appointment({ attendance: null }),
        appointment({ status: "confirmed", startsAt: new Date(2026, 9, 5).toISOString() }),
      ],
      NOW,
    );

    expect(stats.noShowRate).toBe(33);
  });

  it("has no no-show rate before any appointment has taken place", () => {
    expect(computeStats([appointment({ status: "pending" })], NOW).noShowRate).toBeNull();
  });
});

describe("weeklyFillRate", () => {
  // Wednesday 30 September 2026: its week runs Monday 28 to Sunday 4 October.
  const WEEK: AvailabilityDay[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    open: weekday !== 0,
    opens: 9 * 60,
    closes: 19 * 60,
    breakStart: 13 * 60,
    breakEnd: 14 * 60,
  }));
  const BOOKINGS = [
    appointment({ startsAt: new Date(2026, 8, 29, 10, 0).toISOString(), durationMin: 60, status: "confirmed" }),
    appointment({ startsAt: new Date(2026, 8, 30, 10, 0).toISOString(), durationMin: 120, status: "done" }),
    // Not booked yet, or not this week: left out.
    appointment({ startsAt: new Date(2026, 8, 30, 15, 0).toISOString(), durationMin: 60, status: "pending" }),
    appointment({ startsAt: new Date(2026, 9, 5, 10, 0).toISOString(), durationMin: 60, status: "confirmed" }),
  ];

  it("booked minutes over open minutes, lunch breaks left out: 3 h of 54 h", () => {
    expect(weeklyFillRate(BOOKINGS, WEEK, [], NOW)).toEqual({ bookedMinutes: 180, openMinutes: 3240, percent: 6 });
  });

  it("takes a closed day out of the open time", () => {
    const saturdayOff = [
      {
        id: "off",
        startsAt: new Date(2026, 9, 3, 0, 0).toISOString(),
        endsAt: new Date(2026, 9, 4, 0, 0).toISOString(),
        label: "",
      },
    ];

    expect(weeklyFillRate(BOOKINGS, WEEK, saturdayOff, NOW)).toEqual({ bookedMinutes: 180, openMinutes: 2700, percent: 7 });
  });

  it("counts overlapping closures once", () => {
    // Saturday 9:00-12:00, and 10:00-11:00 inside it: 3 hours closed, not 4.
    const overlapping = [
      { id: "a", startsAt: new Date(2026, 9, 3, 9, 0).toISOString(), endsAt: new Date(2026, 9, 3, 12, 0).toISOString(), label: "" },
      { id: "b", startsAt: new Date(2026, 9, 3, 10, 0).toISOString(), endsAt: new Date(2026, 9, 3, 11, 0).toISOString(), label: "" },
    ];

    expect(weeklyFillRate(BOOKINGS, WEEK, overlapping, NOW).openMinutes).toBe(3240 - 180);
  });

  it("adds up a team's open time, each on their own week and congés (TODO.md Phase 3)", () => {
    const owner = { id: "sofia", availability: null };
    // Nadia works Wednesday afternoons only, 14:00-18:00, and is off this Wednesday from 16:00.
    const nadia = {
      id: "nadia",
      availability: WEEK.map((day) => ({ ...day, open: day.weekday === 3, opens: 14 * 60, closes: 18 * 60, breakStart: null, breakEnd: null })),
    };
    const nadiaOff = [
      { startsAt: new Date(2026, 8, 30, 16, 0).toISOString(), endsAt: new Date(2026, 8, 30, 19, 0).toISOString(), staffId: "nadia" },
    ];

    expect(weeklyFillRate(BOOKINGS, WEEK, nadiaOff, NOW, [owner, nadia])).toEqual({
      bookedMinutes: 180,
      openMinutes: 3240 + 120,
      percent: 5,
    });
  });

  it("is 0 % for a week the salon is closed", () => {
    const closed = WEEK.map((day) => ({ ...day, open: false }));
    expect(weeklyFillRate(BOOKINGS, closed, [], NOW)).toEqual({ bookedMinutes: 180, openMinutes: 0, percent: 0 });
  });
});
