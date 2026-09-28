import { paymentState, paymentTotals } from "./payments";
import type { AdminPayment } from "@/services/adminApi";

function payment(overrides: Partial<AdminPayment>): AdminPayment {
  return {
    id: "pay-1",
    appointmentId: "apt-1",
    createdAt: "2026-10-01T10:00:00.000Z",
    clientName: "Camille Durand",
    salonName: "Studio W",
    amount: 40,
    refundedAmount: 0,
    commissionAmount: 4,
    transferAmount: null,
    transferredAt: null,
    status: "succeeded",
    ...overrides,
  };
}

describe("paymentTotals", () => {
  it("adds up what came in, went back, was kept and was paid out — unpaid attempts left out", () => {
    const totals = paymentTotals([
      payment({ amount: 100, commissionAmount: 10, transferAmount: 90, transferredAt: "2026-10-03T10:00:00.000Z" }),
      payment({ amount: 40, refundedAmount: 40, commissionAmount: 4 }),
      payment({ amount: 60, commissionAmount: 6 }),
      payment({ amount: 25, status: "requires_payment" }),
    ]);

    expect(totals).toEqual({ collected: 200, refunded: 40, commission: 10, paidOut: 90 });
  });
});

describe("paymentState", () => {
  it("names where each payment stands", () => {
    expect(paymentState(payment({ status: "requires_payment" }))).toBe("En attente de paiement");
    expect(paymentState(payment({ status: "canceled" }))).toBe("Abandonné");
    expect(paymentState(payment({ refundedAmount: 40 }))).toBe("Remboursé");
    expect(paymentState(payment({ refundedAmount: 10 }))).toBe("Remboursé en partie");
    expect(paymentState(payment({ transferredAt: "2026-10-03T10:00:00.000Z", transferAmount: 36 }))).toBe("Versé au salon");
    expect(paymentState(payment({}))).toBe("Payé");
  });
});
