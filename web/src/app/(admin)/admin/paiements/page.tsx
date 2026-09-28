"use client";

import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { Pagination, pageSlice } from "@/components/admin/Pagination";
import { PAYMENT_STATE_STYLES, paymentState, paymentTotals, refundErrorMessage } from "@/lib/payments";
import { cn } from "@/lib/utils";
import { type AdminPayment, listPayments, refundPayment } from "@/services/adminApi";
import { isAxiosError } from "axios";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/**
 * Every payment made in the app (TODO.md Phase 5): what came in, what went
 * back, what WorldHair kept and what the salons received — and the refund
 * of last resort for disputes, which works even after the salon was paid.
 */
export default function AdminPaiementsPage() {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [refunding, setRefunding] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [refundError, setRefundError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    listPayments()
      .then((data) => {
        setPayments(data);
        setError(null);
      })
      .catch(() => setError("Impossible de charger les paiements."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refund = async (payment: AdminPayment) => {
    const left = Math.round((payment.amount - payment.refundedAmount) * 100) / 100;
    const typed = amount.trim().replace(",", ".");
    const value = typed === "" ? left : Number(typed);
    if (!Number.isFinite(value) || value <= 0 || value > left) {
      setRefundError(`Entre 0,01 € et ${euros.format(left)}.`);
      return;
    }
    if (!window.confirm(`Rembourser ${euros.format(value)} à ${payment.clientName} ?`)) return;
    setSaving(true);
    setRefundError(null);
    try {
      await refundPayment(payment.appointmentId, value === left ? undefined : value);
      setRefunding(null);
      setAmount("");
      load();
    } catch (err) {
      const body = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined) : undefined;
      setRefundError(refundErrorMessage(isAxiosError(err) ? err.response?.status : undefined, body?.message ?? ""));
    } finally {
      setSaving(false);
    }
  };

  const totals = paymentTotals(payments);

  return (
    <>
      <AdminTopBar title="Paiements" />

      <div className="min-w-0 flex-1 px-4 pt-4 pb-8 sm:px-8">
        <div className="flex flex-col gap-4 rounded-3xl bg-[#080f1a] p-4 sm:p-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Encaissé", value: totals.collected },
              { label: "Remboursé", value: totals.refunded },
              { label: "Commission (versements faits)", value: totals.commission },
              { label: "Versé aux salons", value: totals.paidOut },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-[#111c2e] p-4">
                <p className="text-xs text-[#93a6bc]">{stat.label}</p>
                <p className="mt-1 text-lg font-medium text-[#f2f6fb]">{euros.format(stat.value)}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {loading && <p className="py-8 text-center text-sm text-[#93a6bc]">Chargement…</p>}
            {error && <p className="py-8 text-center text-sm text-[#ff7a70]">{error}</p>}
            {!loading && !error && payments.length === 0 && (
              <p className="py-8 text-center text-sm text-[#93a6bc]">Aucun paiement pour l&apos;instant.</p>
            )}

            {!loading &&
              !error &&
              pageSlice(payments, page).map((payment) => {
                const state = paymentState(payment);
                const left = payment.amount - payment.refundedAmount;
                const open = refunding === payment.id;
                return (
                  <div key={payment.id} className="flex flex-col gap-3 rounded-2xl bg-[#111c2e] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#f2f6fb]">
                          {payment.clientName} → {payment.salonName}
                        </p>
                        <p className="text-xs text-[#93a6bc]">
                          {new Date(payment.createdAt).toLocaleString("fr-FR", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: "Europe/Paris",
                          })}
                          {payment.refundedAmount > 0 ? ` · remboursé ${euros.format(payment.refundedAmount)}` : ""}
                          {payment.transferAmount !== null
                            ? ` · versé ${euros.format(payment.transferAmount)}, commission ${euros.format(payment.commissionAmount)}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-medium text-[#f2f6fb]">{euros.format(payment.amount)}</span>
                        <span className={cn("rounded-full px-3 py-1 text-xs font-medium", PAYMENT_STATE_STYLES[state])}>
                          {state}
                        </span>
                        {/* Unpaid: the slot is only held while its client pays — not a booking yet. */}
                        {payment.status === "succeeded" ? (
                          <Link
                            href={`/admin/rendez-vous/${payment.appointmentId}`}
                            className="text-xs text-[#2a93d5] hover:text-white"
                          >
                            Voir le rendez-vous
                          </Link>
                        ) : null}
                        {payment.status === "succeeded" && left > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setRefunding(open ? null : payment.id);
                              setAmount("");
                              setRefundError(null);
                            }}
                            className="rounded-full border border-[#ff7a70]/40 px-4 py-1.5 text-xs text-[#ff7a70] hover:bg-[#ff7a70]/10"
                          >
                            Rembourser
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {open ? (
                      <div className="flex flex-col gap-2 rounded-xl bg-[#080f1a] p-3">
                        <p className="text-xs text-[#93a6bc]">
                          {payment.transferAmount !== null
                            ? "Déjà versé au salon : sa part du remboursement lui est reprise avant de rembourser le client."
                            : "Le salon n'a pas encore été payé : il recevra d'autant moins."}
                        </p>
                        <div className="flex gap-2">
                          <input
                            inputMode="decimal"
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            placeholder={`Tout : ${euros.format(left)}`}
                            aria-label="Montant à rembourser"
                            className="h-10 min-w-0 flex-1 rounded-xl bg-[#111c2e] px-3 text-sm text-[#f2f6fb] placeholder:text-[#5b7186] focus:outline-2 focus:outline-[#2a93d5]"
                          />
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void refund(payment)}
                            className="h-10 shrink-0 rounded-full bg-[#ff7a70] px-5 text-xs font-medium text-white hover:bg-[#ff7a70]/90 disabled:opacity-50"
                          >
                            {saving ? "Remboursement…" : "Confirmer"}
                          </button>
                        </div>
                        {refundError && <p className="text-xs text-[#ff7a70]">{refundError}</p>}
                      </div>
                    ) : null}
                  </div>
                );
              })}

            {!loading && !error && <Pagination page={page} total={payments.length} onPageChange={setPage} />}
          </div>
        </div>
      </div>
    </>
  );
}
