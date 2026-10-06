import { canStillChange, isConfirmedOnSite, paymentLabel, type Appointment } from "./booking";

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
    payment: null,
    confirmedByClientAt: null,
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

describe("paymentLabel", () => {
  it("says what was paid in the app, and what came back", () => {
    expect(paymentLabel(appointment({ payment: { amount: 40, refundedAmount: 0 } }))).toBe("Payé 40 €");
    expect(paymentLabel(appointment({ payment: { amount: 40, refundedAmount: 40 } }))).toBe("Remboursé 40 €");
    expect(paymentLabel(appointment({ payment: { amount: 40, refundedAmount: 15.5 } }))).toBe("Remboursé 15,50 € sur 40 €");
  });

  it("says nothing for a booking paid outside the app", () => {
    expect(paymentLabel(appointment({ payment: null }))).toBeNull();
  });
});

describe("isConfirmedOnSite", () => {
  it("is true once the client scanned the salon's code", () => {
    expect(isConfirmedOnSite(appointment({ status: "done", confirmedByClientAt: "2026-10-02T09:00:00.000Z" }))).toBe(true);
    expect(isConfirmedOnSite(appointment({ status: "confirmed", confirmedByClientAt: "2026-10-02T09:00:00.000Z" }))).toBe(true);
  });

  it("is false without a scan, or for a booking cancelled since", () => {
    expect(isConfirmedOnSite(appointment({ status: "done", confirmedByClientAt: null }))).toBe(false);
    expect(isConfirmedOnSite(appointment({ status: "cancelled", confirmedByClientAt: "2026-10-02T09:00:00.000Z" }))).toBe(false);
  });
});
