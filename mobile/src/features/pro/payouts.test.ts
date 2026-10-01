import type { ProAppointment } from "./types";
import { payoutLine, waitingPayout } from "./payouts";

const NOW = new Date("2026-10-01T10:00:00Z");

function paid(overrides: Partial<ProAppointment> = {}, payment: Partial<NonNullable<ProAppointment["payment"]>> = {}) {
  return {
    id: "a1",
    status: "confirmed",
    startsAt: "2026-10-01T13:30:00Z",
    durationMin: 60,
    payment: { amount: 68, refundedAmount: 0, commissionAmount: 6.8, payoutAmount: 61.2, paidOutAt: null, ...payment },
    ...overrides,
  } as ProAppointment;
}

describe("payoutLine", () => {
  it("gives the date a ready salon will be paid: a day after the appointment ends", () => {
    expect(payoutLine(paid(), "ready", NOW)).toBe("Commission 6,80 € · versement de 61,20 € prévu le vendredi 2 octobre 2026");
  });

  it("says a payout past its date is on its way", () => {
    expect(payoutLine(paid({ startsAt: "2026-09-29T09:00:00Z" }), "ready", NOW)).toBe(
      "Commission 6,80 € · versement de 61,20 € en cours",
    );
  });

  it("tells a salon without active payouts that its money waits for them, instead of a date that won't hold", () => {
    for (const state of ["none", "incomplete", "exempt"] as const) {
      expect(payoutLine(paid(), state, NOW)).toBe(
        "Commission 6,80 € · 61,20 € en attente : configurez vos paiements pour les recevoir",
      );
    }
  });

  it("says when it was paid", () => {
    expect(payoutLine(paid({}, { paidOutAt: "2026-10-02T15:00:00Z" }), "incomplete", NOW)).toBe(
      "Commission 6,80 € · versé 61,20 € le vendredi 2 octobre 2026",
    );
  });

  it("says nothing about a payout for a booking cancelled or refunded in full", () => {
    expect(payoutLine(paid({ status: "cancelled" }), "ready", NOW)).toBeNull();
    expect(payoutLine(paid({ status: "refused" }), "ready", NOW)).toBeNull();
    expect(payoutLine(paid({}, { refundedAmount: 68 }), "ready", NOW)).toBeNull();
  });
});

describe("waitingPayout", () => {
  it("adds up what's owed and not paid yet", () => {
    const appointments = [
      paid(),
      paid({ id: "a2" }, { payoutAmount: 20, paidOutAt: "2026-09-30T10:00:00Z" }),
      paid({ id: "a3", status: "cancelled" }),
      paid({ id: "a4" }, { refundedAmount: 68 }),
      paid({ id: "a5" }, { payoutAmount: 18.8 }),
      { ...paid({ id: "a6" }), payment: null },
    ];
    expect(waitingPayout(appointments)).toBe(80);
  });
});
