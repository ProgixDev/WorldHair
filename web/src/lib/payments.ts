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

/** The badge of each `paymentState`. */
export const PAYMENT_STATE_STYLES: Record<string, string> = {
  "En attente de paiement": "bg-white/10 text-[#93a6bc]",
  Abandonné: "bg-white/10 text-[#93a6bc]",
  Remboursé: "bg-[#ff7a70]/15 text-[#ff7a70]",
  "Remboursé en partie": "bg-[#e4b980]/15 text-[#e4b980]",
  "Versé au salon": "bg-[#1f9d55]/15 text-[#1f9d55]",
  Payé: "bg-[#2a93d5]/15 text-[#2a93d5]",
};

/** Where a payment stands, in the admin's words — a payment of the list, or a booking's. */
export function paymentState(payment: Pick<AdminPayment, "status" | "amount" | "refundedAmount" | "transferredAt">): string {
  if (payment.status === "requires_payment") return "En attente de paiement";
  if (payment.status === "canceled") return "Abandonné";
  if (payment.refundedAmount >= payment.amount) return "Remboursé";
  if (payment.refundedAmount > 0) return "Remboursé en partie";
  if (payment.transferredAt) return "Versé au salon";
  return "Payé";
}
