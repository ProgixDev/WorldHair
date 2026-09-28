import type { AdminPayment } from "@/services/adminApi";

export interface PaymentTotals {
  /** Paid by clients (unfinished or abandoned attempts left out). */
  collected: number;
  refunded: number;
  /** Kept by WorldHair on payments already paid out. */
  commission: number;
  /** Sent to the salons. */
  paidOut: number;
}

const round2 = (euros: number) => Math.round(euros * 100) / 100;

/** The summary row of `/admin/paiements`. */
export function paymentTotals(payments: AdminPayment[]): PaymentTotals {
  const paid = payments.filter((payment) => payment.status === "succeeded");
  const paidOut = paid.filter((payment) => payment.transferredAt);
  return {
    collected: round2(paid.reduce((sum, payment) => sum + payment.amount, 0)),
    refunded: round2(paid.reduce((sum, payment) => sum + payment.refundedAmount, 0)),
    commission: round2(paidOut.reduce((sum, payment) => sum + payment.commissionAmount, 0)),
    paidOut: round2(paidOut.reduce((sum, payment) => sum + (payment.transferAmount ?? 0), 0)),
  };
}

/** Why the server refused a refund, for the admin — its answers are in English (server/src/payments/payments.service.ts). */
export function refundErrorMessage(status: number | undefined, message: string): string {
  if (status === 409) {
    return message.includes("payout")
      ? "Le versement au salon est en cours d'envoi : réessayez dans une heure."
      : "Un remboursement ou un versement est en cours sur ce paiement : réessayez dans une minute.";
  }
  if (status === 400) return "Remboursement refusé : le montant dépasse ce qui reste.";
  return "Remboursement impossible. Réessayez.";
}

/** Where a payment stands, in the admin's words. */
export function paymentState(payment: AdminPayment): string {
  if (payment.status === "requires_payment") return "En attente de paiement";
  if (payment.status === "canceled") return "Abandonné";
  if (payment.refundedAmount >= payment.amount) return "Remboursé";
  if (payment.refundedAmount > 0) return "Remboursé en partie";
  if (payment.transferredAt) return "Versé au salon";
  return "Payé";
}
