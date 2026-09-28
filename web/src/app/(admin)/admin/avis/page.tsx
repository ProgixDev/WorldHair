"use client";

import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { Pagination, pageCount, pageSlice } from "@/components/admin/Pagination";
import { reportReasonLabel, reporterRoleLabel } from "@/lib/reviews";
import { cn } from "@/lib/utils";
import { type ModeratedReview, listHiddenReviews, listReportedReviews, moderateReview } from "@/services/adminApi";
import { Flag, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Tab = "reported" | "hidden";

const TABS: { value: Tab; label: string }[] = [
  { value: "reported", label: "Signalés" },
  { value: "hidden", label: "Masqués" },
];

const reportedOn = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });

/**
 * « Avis » (TODO.md Phases 6-7): the reviews clients or salons reported, with
 * who reported each and why, to hide or keep — and the hidden ones, to put
 * one back.
 */
export default function AdminAvisPage() {
  const [tab, setTab] = useState<Tab>("reported");
  const [reviews, setReviews] = useState<ModeratedReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  /** Bumped after a decision: the list is read again. */
  const [version, setVersion] = useState(0);

  // A `.then()` chain started in the effect — not an async function awaited
  // in it — is what satisfies react-hooks/set-state-in-effect (see
  // AdminAuthGuard). An answer for a tab left meanwhile is dropped.
  useEffect(() => {
    let current = true;
    (tab === "reported" ? listReportedReviews() : listHiddenReviews())
      .then((data) => {
        if (!current) return;
        setReviews(data);
        setError(null);
      })
      .catch(() => {
        if (current) setError(tab === "reported" ? "Impossible de charger les avis signalés." : "Impossible de charger les avis masqués.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [tab, version]);

  const changeTab = (next: Tab) => {
    if (next === tab) return;
    setLoading(true);
    setError(null);
    setActionError(null);
    setReviews([]);
    setPage(1);
    setTab(next);
  };

  const handleModerate = async (id: string, decision: "hide" | "restore") => {
    setActioningId(id);
    setActionError(null);
    try {
      await moderateReview(id, decision);
      setVersion((count) => count + 1);
    } catch {
      setActionError("La décision n'a pas pu être enregistrée. Réessayez.");
    } finally {
      setActioningId(null);
    }
  };

  // The last review of the last page decided: its page is gone, show the one before.
  const shownPage = Math.min(page, pageCount(reviews.length));

  return (
    <>
      <AdminTopBar title="Avis" />

      <div className="min-w-0 flex-1 px-4 pt-4 pb-8 sm:px-8">
        <div className="rounded-3xl bg-[#080f1a] p-4 sm:p-6">
          <div className="flex items-center gap-6">
            {TABS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => changeTab(option.value)}
                className={cn(
                  "text-sm transition-colors",
                  tab === option.value
                    ? "border-b-2 border-[#2a93d5] pb-1 font-medium text-[#f2f6fb]"
                    : "text-[#93a6bc] hover:text-white",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <p className="mt-4 text-xs text-[#93a6bc]">
            {tab === "reported"
              ? "Un avis signalé reste visible publiquement tant qu'il n'est pas masqué ici — le signalement seul ne le retire pas."
              : "Masqués, ces avis ne comptent plus dans la note du salon. Remis en ligne, ils comptent de nouveau."}
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {actionError && <p className="text-sm text-[#ff7a70]">{actionError}</p>}
            {loading && <p className="py-8 text-center text-sm text-[#93a6bc]">Chargement…</p>}
            {error && <p className="py-8 text-center text-sm text-[#ff7a70]">{error}</p>}
            {!loading && !error && reviews.length === 0 && (
              <p className="py-8 text-center text-sm text-[#93a6bc]">
                {tab === "reported" ? "Aucun avis signalé pour le moment." : "Aucun avis masqué."}
              </p>
            )}

            {!loading &&
              !error &&
              pageSlice(reviews, shownPage).map((review) => (
                <div key={review.id} className="rounded-2xl bg-[#111c2e] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium text-[#f2f6fb]">{review.authorFullName}</span>
                      <span className="flex items-center gap-1 text-xs text-[#b8813f]">
                        <Star className="size-3 fill-current" aria-hidden="true" />
                        {review.rating}
                      </span>
                    </div>
                    <span className="text-xs text-[#93a6bc]">
                      sur{" "}
                      <Link href={`/admin/comptes/${review.salonId}`} className="text-[#f2f6fb] hover:text-[#2a93d5]">
                        {review.salonName}
                      </Link>{" "}
                      · {new Date(review.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>

                  <p className="mt-3 text-sm whitespace-pre-line text-[#93a6bc]">
                    {review.comment || <span className="italic">Sans commentaire.</span>}
                  </p>

                  {review.tags.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {review.tags.map((tag) => (
                        <li key={tag} className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-[#93a6bc]">
                          {tag}
                        </li>
                      ))}
                    </ul>
                  )}

                  {review.reply && (
                    <p className="mt-3 rounded-xl bg-white/5 p-3 text-xs text-[#93a6bc]">
                      Réponse du coiffeur : {review.reply}
                    </p>
                  )}

                  <Reports review={review} />

                  <div className="mt-4 flex flex-wrap gap-2">
                    {tab === "reported" ? (
                      <>
                        <button
                          type="button"
                          disabled={actioningId === review.id}
                          onClick={() => void handleModerate(review.id, "hide")}
                          className="rounded-full bg-[#b3261e] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#921f18] disabled:opacity-50"
                        >
                          Masquer l&apos;avis
                        </button>
                        <button
                          type="button"
                          disabled={actioningId === review.id}
                          onClick={() => void handleModerate(review.id, "restore")}
                          className="rounded-full bg-white/10 px-4 py-2 text-xs text-[#93a6bc] hover:text-white disabled:opacity-50"
                        >
                          Marquer comme sûr
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={actioningId === review.id}
                        onClick={() => void handleModerate(review.id, "restore")}
                        className="rounded-full bg-white/10 px-4 py-2 text-xs text-[#93a6bc] hover:text-white disabled:opacity-50"
                      >
                        Remettre en ligne
                      </button>
                    )}
                  </div>
                </div>
              ))}

            {!loading && !error && <Pagination page={shownPage} total={reviews.length} onPageChange={setPage} />}
          </div>
        </div>
      </div>
    </>
  );
}

/** Who reported the review and why — or, for one reported before each report was kept, the reason it keeps. */
function Reports({ review }: { review: ModeratedReview }) {
  if (review.reports.length === 0) {
    return review.reportReason ? (
      <p className="mt-3 flex items-start gap-2 text-xs text-[#e4b980]">
        <Flag className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        {reportReasonLabel(review.reportReason)}
      </p>
    ) : null;
  }
  return (
    <div className="mt-3 rounded-xl border border-[#e4b980]/25 p-3">
      <p className="flex items-center gap-2 text-xs font-medium text-[#e4b980]">
        <Flag className="size-3" aria-hidden="true" />
        {review.reports.length === 1 ? "1 signalement" : `${review.reports.length} signalements`}
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {review.reports.map((report) => (
          <li key={report.reporterId} className="text-xs text-[#93a6bc]">
            <span className="font-medium text-[#f2f6fb]">{reportReasonLabel(report.reason)}</span> — par{" "}
            <Link href={`/admin/comptes/${report.reporterId}`} className="text-[#f2f6fb] hover:text-[#2a93d5]">
              {report.reporterName}
            </Link>{" "}
            ({reporterRoleLabel(report.reporterRole)}), le {reportedOn.format(new Date(report.createdAt))}
            {report.details && <span className="mt-1 block whitespace-pre-line italic">« {report.details} »</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
