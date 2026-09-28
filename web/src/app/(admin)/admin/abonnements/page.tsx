"use client";

import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { Pagination, pageSlice } from "@/components/admin/Pagination";
import { cn } from "@/lib/utils";
import { type AdminSubscriptionSummary, listSubscriptions } from "@/services/adminApi";
import { ExternalLink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const PLAN_LABELS: Record<AdminSubscriptionSummary["plan"], string> = {
  monthly: "Mensuel",
  yearly: "Annuel",
};

const STATE_STYLES: Record<AdminSubscriptionSummary["state"], string> = {
  none: "bg-white/10 text-[#93a6bc]",
  trialing: "bg-[#2a93d5]/15 text-[#2a93d5]",
  active: "bg-[#1f9d55]/15 text-[#1f9d55]",
  ending: "bg-[#e4b980]/15 text-[#e4b980]",
  past_due: "bg-[#ff7a70]/15 text-[#ff7a70]",
  incomplete: "bg-[#e4b980]/15 text-[#e4b980]",
  expired: "bg-[#ff7a70]/15 text-[#ff7a70]",
};

const STATE_LABELS: Record<AdminSubscriptionSummary["state"], string> = {
  none: "Pas d'abonnement",
  trialing: "Essai",
  active: "Actif",
  ending: "Résilié (fin prévue)",
  past_due: "Paiement refusé",
  incomplete: "Paiement en attente",
  expired: "Terminé",
};

/** The date that matters: the end if one is set, else the first charge (trial) or the next renewal. */
function echeanceOf(subscription: AdminSubscriptionSummary): string | null {
  if (subscription.endsAt) return subscription.endsAt;
  if (subscription.state === "trialing") return subscription.trialEndsAt;
  if (subscription.state === "active" || subscription.state === "past_due") return subscription.currentPeriodEnd;
  return null;
}

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
              const echeance = echeanceOf(subscription);
              const offered = subscription.stripeStatus === null && subscription.state !== "none";

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
                      {subscription.state === "none" ? "—" : offered ? "Offert" : PLAN_LABELS[subscription.plan]}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        STATE_STYLES[subscription.state],
                      )}
                    >
                      {STATE_LABELS[subscription.state]}
                    </span>
                    <span className="ml-auto shrink-0 text-right text-xs text-[#93a6bc] sm:ml-0 sm:w-28">
                      {echeance ? new Date(echeance).toLocaleDateString("fr-FR") : "—"}
                    </span>
                    {subscription.stripeCustomerUrl ? (
                      <a
                        href={subscription.stripeCustomerUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Voir ${fullName || subscription.email} dans Stripe`}
                        className="grid size-8 shrink-0 place-items-center rounded-full text-[#93a6bc] hover:bg-white/10 hover:text-[#f2f6fb]"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    ) : (
                      <span className="size-8 shrink-0" aria-hidden />
                    )}
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
