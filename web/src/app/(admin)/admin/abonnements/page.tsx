"use client";

import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { Pagination, pageSlice } from "@/components/admin/Pagination";
import { cn } from "@/lib/utils";
import { type AdminSubscriptionSummary, listSubscriptions } from "@/services/adminApi";
import { useCallback, useEffect, useState } from "react";

const PLAN_LABELS: Record<AdminSubscriptionSummary["plan"], string> = {
  monthly: "Mensuel",
  yearly: "Annuel",
};

const STATUS_STYLES: Record<AdminSubscriptionSummary["status"], string> = {
  trial: "bg-[#2a93d5]/15 text-[#2a93d5]",
  active: "bg-[#1f9d55]/15 text-[#1f9d55]",
  cancelled: "bg-[#e4b980]/15 text-[#e4b980]",
  expired: "bg-[#ff7a70]/15 text-[#ff7a70]",
  not_started: "bg-white/10 text-[#93a6bc]",
};

const STATUS_LABELS: Record<AdminSubscriptionSummary["status"], string> = {
  trial: "Essai",
  active: "Actif",
  cancelled: "Annulé",
  expired: "Expiré",
  not_started: "Non commencé",
};

export default function AdminAbonnementsPage() {
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    listSubscriptions()
      .then((data) => {
        setSubscriptions(data);
        setError(null);
      })
      .catch(() => setError("Impossible de charger les abonnements."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <AdminTopBar title="Abonnements" />

      <div className="min-w-0 flex-1 px-4 pt-4 pb-8 sm:px-8">
        <div className="rounded-3xl bg-[#080f1a] p-4 sm:p-6">
          <div className="flex flex-col gap-3">
            {loading && (
              <p className="py-8 text-center text-sm text-[#93a6bc]">Chargement…</p>
            )}
            {error && (
              <p className="py-8 text-center text-sm text-[#ff7a70]">{error}</p>
            )}
            {!loading && !error && subscriptions.length === 0 && (
              <p className="py-8 text-center text-sm text-[#93a6bc]">Aucun coiffeur.</p>
            )}

            {!loading &&
              !error &&
              pageSlice(subscriptions, page).map((subscription) => {
              const fullName = `${subscription.firstName} ${subscription.lastName}`.trim();
              const echeance =
                subscription.status === "trial"
                  ? subscription.trialEndsAt
                  : subscription.renewsAt;

              return (
                // Same stacking as the accounts list: the name/email column is
                // the only flexible child, so on one wrapping row it was the
                // one thing that got squeezed away.
                <div
                  key={subscription.profileId}
                  className="flex flex-col gap-3 rounded-2xl bg-[#111c2e] p-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3 sm:flex-1 sm:gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#1e2e45] text-xs font-bold text-[#f2f6fb]">
                      {(fullName || subscription.email)[0]?.toUpperCase() ?? "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#f2f6fb]">
                        {fullName || subscription.email}
                      </p>
                      {fullName && (
                        <p className="truncate text-xs text-[#93a6bc]">{subscription.email}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    <span className="text-xs text-[#93a6bc]">
                      {PLAN_LABELS[subscription.plan]}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        STATUS_STYLES[subscription.status],
                      )}
                    >
                      {STATUS_LABELS[subscription.status]}
                    </span>
                    <span className="ml-auto shrink-0 text-right text-xs text-[#93a6bc] sm:ml-0 sm:w-28">
                      {echeance ? new Date(echeance).toLocaleDateString("fr-FR") : "—"}
                    </span>
                  </div>
                </div>
              );
            })}

            {!loading && !error && (
              <Pagination page={page} total={subscriptions.length} onPageChange={setPage} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
