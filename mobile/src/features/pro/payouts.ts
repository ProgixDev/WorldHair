import { fullDate } from "../../utils/date";
import type { PayoutStatus, ProAppointment } from "./types";

/** A day after the appointment's end: when the salon's share is sent (server/src/payments/payments.service.ts). */
const PAYOUT_DELAY_MS = 24 * 3_600_000;

export function euros(amount: number): string {
  return (Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(".", ",")) + " €";
}

type PaidAppointment = ProAppointment & { payment: NonNullable<ProAppointment["payment"]> };

/** Still owed to the salon: paid, not cancelled nor refunded in full, not sent yet. */
function owed(appointment: ProAppointment): appointment is PaidAppointment {
  const { payment } = appointment;
  return (
    payment !== null &&
    payment.paidOutAt === null &&
    payment.refundedAmount < payment.amount &&
    appointment.status !== "cancelled" &&
    appointment.status !== "refused"
  );
}

/**
 * Where a paid booking's money stands for the salon: sent, due on a date,
 * on its way — or waiting for the salon's payouts, which it can't get
 * without them (the date would be a promise WorldHair can't keep).
 */
export function payoutLine(
  appointment: ProAppointment,
  state: PayoutStatus["state"] | undefined,
  now: Date = new Date(),
): string | null {
  const { payment } = appointment;
  if (!payment) return null;
  const commission = "Commission " + euros(payment.commissionAmount) + " · ";
  if (payment.paidOutAt) {
    return commission + "versé " + euros(payment.payoutAmount) + " le " + fullDate(new Date(payment.paidOutAt));
  }
  if (!owed(appointment)) return null;
  if (state !== "ready") {
    return commission + euros(payment.payoutAmount) + " en attente : configurez vos paiements pour les recevoir";
  }
  const due = new Date(new Date(appointment.startsAt).getTime() + appointment.durationMin * 60_000 + PAYOUT_DELAY_MS);
  return due <= now
    ? commission + "versement de " + euros(payment.payoutAmount) + " en cours"
    : commission + "versement de " + euros(payment.payoutAmount) + " prévu le " + fullDate(due);
}

/** What the salon's clients paid that hasn't reached the salon yet. */
export function waitingPayout(appointments: ProAppointment[]): number {
  const cents = appointments.filter(owed).reduce((sum, appointment) => sum + Math.round(appointment.payment.payoutAmount * 100), 0);
  return cents / 100;
}
