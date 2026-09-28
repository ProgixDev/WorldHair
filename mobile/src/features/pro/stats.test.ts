import { computeStats } from "./stats";
import type { ProAppointment } from "./types";

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
    ...overrides,
  };
}

describe("computeStats", () => {
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
