import { canStillChange, type Appointment } from "./booking";

jest.mock("../lib/apiClient", () => ({ apiClient: {} }));

function appointment(overrides: Partial<Appointment>): Appointment {
  return {
    id: "a1",
    salonId: "s1",
    salonName: "Studio W",
    serviceId: "svc1",
    serviceName: "Coupe",
    startsAt: "2026-10-02T08:00:00.000Z",
    durationMin: 60,
    price: 40,
    services: [],
    status: "confirmed",
    attendance: null,
    modifiableUntil: null,
    movedBySalon: false,
    createdAt: "2026-09-20T08:00:00.000Z",
    ...overrides,
  };
}

describe("canStillChange", () => {
  const NOW = new Date("2026-10-01T10:00:00.000Z");

  it("is true for an active booking with no deadline", () => {
    expect(canStillChange(appointment({ modifiableUntil: null }), NOW)).toBe(true);
  });

  it("follows the salon's deadline", () => {
    expect(canStillChange(appointment({ modifiableUntil: "2026-10-01T12:00:00.000Z" }), NOW)).toBe(true);
    expect(canStillChange(appointment({ modifiableUntil: "2026-10-01T08:00:00.000Z" }), NOW)).toBe(false);
  });

  it("is false once the booking is no longer active", () => {
    expect(canStillChange(appointment({ status: "cancelled" }), NOW)).toBe(false);
    expect(canStillChange(appointment({ status: "done" }), NOW)).toBe(false);
  });
});
