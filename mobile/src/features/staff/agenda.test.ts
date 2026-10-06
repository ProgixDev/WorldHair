import type { ProAppointment } from "../pro/types";
import { canMarkAttendance, staffAgendaSections, timeRange } from "./agenda";

const NOW = new Date(2026, 9, 5, 12, 0); // Monday 5 October 2026, noon

function booking(id: string, startsAt: Date, overrides: Partial<ProAppointment> = {}): ProAppointment {
  return {
    id,
    serviceId: "svc1",
    clientName: "Camille Durand",
    clientId: "c1",
    startsAt: startsAt.toISOString(),
    durationMin: 45,
    price: 40,
    services: [{ serviceId: "svc1", name: "Coupe", price: 40, durationMin: 45 }],
    status: "confirmed",
    attendance: null,
    isNewClient: false,
    payment: null,
    staffId: "s1",
    staffName: "Léa Martin",
    confirmedByClientAt: null,
    ...overrides,
  };
}

describe("staffAgendaSections", () => {
  it("splits the bookings into today, to come and past, each in reading order", () => {
    const sections = staffAgendaSections(
      [
        booking("tomorrow", new Date(2026, 9, 6, 9, 0)),
        booking("today-late", new Date(2026, 9, 5, 17, 0)),
        booking("today-early", new Date(2026, 9, 5, 9, 0)),
        booking("next-week", new Date(2026, 9, 12, 10, 0)),
        booking("yesterday", new Date(2026, 9, 4, 15, 0)),
        booking("last-week", new Date(2026, 8, 28, 15, 0)),
      ],
      NOW,
    );

    expect(sections.today.map((item) => item.id)).toEqual(["today-early", "today-late"]);
    expect(sections.upcoming.map((item) => item.id)).toEqual(["tomorrow", "next-week"]);
    // Most recent first.
    expect(sections.past.map((item) => item.id)).toEqual(["yesterday", "last-week"]);
  });

  it("keeps the past to the last 30 days", () => {
    const sections = staffAgendaSections(
      [
        booking("29-days", new Date(2026, 8, 6, 10, 0)),
        booking("31-days", new Date(2026, 8, 4, 10, 0)),
      ],
      NOW,
    );
    expect(sections.past.map((item) => item.id)).toEqual(["29-days"]);
  });

  it("leaves out anything no longer accepted", () => {
    const sections = staffAgendaSections(
      [
        booking("cancelled", new Date(2026, 9, 6, 9, 0), { status: "cancelled" }),
        booking("refused", new Date(2026, 9, 6, 10, 0), { status: "refused" }),
        booking("held", new Date(2026, 9, 6, 11, 0), { status: "pending" }),
        booking("done", new Date(2026, 9, 2, 11, 0), { status: "done" }),
      ],
      NOW,
    );
    expect(sections.upcoming).toEqual([]);
    expect(sections.past.map((item) => item.id)).toEqual(["done"]);
  });
});

describe("canMarkAttendance", () => {
  it("opens honoré/absent once the booking has started, until marked", () => {
    expect(canMarkAttendance(booking("started", new Date(2026, 9, 5, 11, 45)), NOW)).toBe(true);
    expect(canMarkAttendance(booking("past", new Date(2026, 9, 1, 10, 0), { status: "done" }), NOW)).toBe(true);
    expect(canMarkAttendance(booking("later", new Date(2026, 9, 5, 14, 0)), NOW)).toBe(false);
    expect(
      canMarkAttendance(booking("marked", new Date(2026, 9, 5, 9, 0), { attendance: "attended" }), NOW),
    ).toBe(false);
    expect(
      canMarkAttendance(booking("cancelled", new Date(2026, 9, 5, 9, 0), { status: "cancelled" }), NOW),
    ).toBe(false);
  });
});

describe("timeRange", () => {
  it("reads as start – end", () => {
    expect(timeRange(booking("a", new Date(2026, 9, 5, 14, 30), { durationMin: 75 }))).toBe("14:30 – 15:45");
  });
});
