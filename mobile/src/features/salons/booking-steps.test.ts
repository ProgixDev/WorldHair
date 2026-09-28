import { stepAfterSlot, stepBeforeConfirm } from "./booking-steps";

describe("booking steps", () => {
  it("goes through payment for a new booking", () => {
    expect(stepAfterSlot({ isReschedule: false, paidAmount: null, total: 65 })).toBe("payment");
    expect(stepBeforeConfirm({ isReschedule: false, paidAmount: null, total: 65 })).toBe("payment");
  });

  it("skips payment for a reschedule: the booking is already paid", () => {
    expect(stepAfterSlot({ isReschedule: true, paidAmount: null, total: 65 })).toBe("confirm");
    expect(stepBeforeConfirm({ isReschedule: true, paidAmount: null, total: 65 })).toBe("slot");
  });

  it("never asks to pay the same total twice, e.g. after the slot was taken meanwhile", () => {
    expect(stepAfterSlot({ isReschedule: false, paidAmount: 65, total: 65 })).toBe("confirm");
    expect(stepBeforeConfirm({ isReschedule: false, paidAmount: 65, total: 65 })).toBe("slot");
  });

  it("asks for payment again once the prestations, and so the total, have changed", () => {
    expect(stepAfterSlot({ isReschedule: false, paidAmount: 40, total: 65 })).toBe("payment");
  });
});
