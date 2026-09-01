"use client";

import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { type Review, listReportedReviews, moderateReview } from "@/services/adminApi";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";

export default function AdminAvisPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  // A plain function that starts a `.then()` chain — not an async function
  // awaited directly in the effect — is what actually satisfies
  // react-hooks/set-state-in-effect (see AdminAuthGuard for the same shape).
  const load = () => {
    listReportedReviews()
      .then((data) => {
        setReviews(data);
        setError(null);
      })
      .catch(() => setError("Impossible de charger les avis signalés."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleModerate = async (id: string, decision: "hide" | "restore") => {
    setActioningId(id);
    try {
      await moderateReview(id, decision);
      await load();
    } finally {
      setActioningId(null);
    }
  };

  return (
    <>
      <AdminTopBar title="Avis signalés" />

      <div className="min-w-0 flex-1 px-6 pt-4 pb-8 sm:px-8">
        <div className="rounded-3xl bg-[#080f1a] p-5 sm:p-6">
          <p className="text-xs text-[#93a6bc]">
            Un avis signalé reste visible publiquement tant qu&apos;il n&apos;est
            pas masqué ici — le signalement seul ne le retire pas.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {loading && (
              <p className="py-8 text-center text-sm text-[#93a6bc]">Chargement…</p>
            )}
            {error && (
              <p className="py-8 text-center text-sm text-[#ff7a70]">{error}</p>
            )}
            {!loading && !error && reviews.length === 0 && (
              <p className="py-8 text-center text-sm text-[#93a6bc]">
                Aucun avis signalé pour le moment.
              </p>
            )}

            {reviews.map((review) => (
              <div key={review.id} className="rounded-2xl bg-[#111c2e] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#f2f6fb]">
                      {review.authorName}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-[#b8813f]">
                      <Star className="size-3 fill-current" aria-hidden="true" />
                      {review.rating}
                    </span>
                  </div>
                  <span className="text-xs text-[#93a6bc]">
                    {new Date(review.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>

                <p className="mt-3 text-sm text-[#93a6bc]">{review.comment}</p>

                {review.tags.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {review.tags.map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-[#93a6bc]"
                      >
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

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={actioningId === review.id}
                    onClick={() => void handleModerate(review.id, "hide")}
                    className="rounded-full bg-[#b3261e] px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
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
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
