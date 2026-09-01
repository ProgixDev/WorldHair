"use client";

import {
  type CoiffeurApplication,
  type Review,
  listCoiffeurApplications,
  listReportedReviews,
} from "@/services/adminApi";
import { ChevronRight, Star } from "lucide-react";
import { useEffect, useState } from "react";

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** The two real admin queues (TODO.md → Back-office admin), always visible
 * without scrolling past the chart — real data, capped to the 3/2 most
 * recent so the rail stays a glance, not a second full list. */
export function AdminQueueRail() {
  const [applications, setApplications] = useState<CoiffeurApplication[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [applicationsError, setApplicationsError] = useState(false);
  const [reviewsError, setReviewsError] = useState(false);

  useEffect(() => {
    listCoiffeurApplications("pending")
      .then((all) => setApplications(all.slice(0, 3)))
      .catch(() => setApplicationsError(true));
    listReportedReviews()
      .then((all) => setReviews(all.slice(0, 2)))
      .catch(() => setReviewsError(true));
  }, []);

  return (
    <aside className="flex w-full shrink-0 flex-col gap-8 px-6 py-6 xl:w-80">
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-[#f2f6fb]">
            Dossiers en attente
          </h2>
          <a
            href="/admin/dossiers"
            className="text-xs text-[#93a6bc] transition-colors hover:text-white"
          >
            Tout voir
          </a>
        </div>

        <ul className="mt-3 flex flex-col gap-2">
          {applicationsError && (
            <li className="p-3 text-xs text-[#ff7a70]">Impossible de charger les dossiers.</li>
          )}
          {!applicationsError && applications.length === 0 && (
            <li className="p-3 text-xs text-[#5b7186]">Aucun dossier en attente.</li>
          )}
          {applications.map((application) => (
            <li key={application.id}>
              <a
                href="/admin/dossiers"
                className="flex items-center gap-3 rounded-2xl bg-[#111c2e] p-3 transition-colors hover:bg-[#1a2b45]"
              >
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-[#1e2e45] text-[11px] font-bold text-[#f2f6fb]"
                >
                  {initials(application.firstName, application.lastName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-[#f2f6fb]">
                    {application.salonName}
                  </p>
                  <p className="truncate text-xs text-[#93a6bc]">
                    {application.practiceZone === "salon" ? application.city : "Domicile"} ·{" "}
                    {daysSince(application.submittedAt)} j
                  </p>
                </div>
                <ChevronRight
                  className="size-4 shrink-0 text-[#5b7186]"
                  aria-hidden="true"
                />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-[#f2f6fb]">
            Avis signalés
          </h2>
          <a
            href="/admin/avis"
            className="text-xs text-[#93a6bc] transition-colors hover:text-white"
          >
            Tout voir
          </a>
        </div>

        <ul className="mt-3 flex flex-col gap-2">
          {reviewsError && (
            <li className="p-3 text-xs text-[#ff7a70]">Impossible de charger les avis.</li>
          )}
          {!reviewsError && reviews.length === 0 && (
            <li className="p-3 text-xs text-[#5b7186]">Aucun avis signalé.</li>
          )}
          {reviews.map((review) => (
            <li key={review.id}>
              <a
                href="/admin/avis"
                className="flex flex-col gap-1.5 rounded-2xl bg-[#111c2e] p-3 transition-colors hover:bg-[#1a2b45]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[#f2f6fb]">
                    {review.authorName}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-[#b8813f]">
                    <Star className="size-3 fill-current" aria-hidden="true" />
                    {review.rating}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs text-[#93a6bc]">
                  {review.comment}
                </p>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
