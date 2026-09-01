import { ChevronRight, Star } from "lucide-react";

/**
 * The two real admin queues (TODO.md → Back-office admin), always visible
 * without scrolling past the chart. `APPLICATIONS`' shape mirrors the real
 * `CoiffeurApplicationDto` (server/src/coiffeur/dto/application.dto.ts), so
 * wiring `GET /admin/coiffeur-applications` in later is a swap of this array
 * for the fetch.
 */
const APPLICATIONS = [
  {
    id: "1",
    salonName: "Maison Amara",
    firstName: "Amara",
    lastName: "Diallo",
    city: "Paris 11e",
    waitingDays: 2,
  },
  {
    id: "2",
    salonName: "Atelier Rive Gauche",
    firstName: "Léo",
    lastName: "Marchand",
    city: "Paris 6e",
    waitingDays: 4,
  },
  {
    id: "3",
    salonName: "Studio Nord",
    firstName: "Inès",
    lastName: "Berger",
    city: "Lille",
    waitingDays: 6,
  },
];

/**
 * Shaped after the real `ReviewDto` (server/src/reviews/reviews.service.ts):
 * `authorName` / `rating` / `comment` — note there's no salon *name* on that
 * DTO, only `salonId`, so this doesn't invent one either.
 */
const REPORTED_REVIEWS = [
  {
    id: "1",
    authorName: "Julien P.",
    rating: 2,
    comment: "Retard de 40 minutes non prévenu, prestation bâclée.",
  },
  {
    id: "2",
    authorName: "Sofia R.",
    rating: 1,
    comment: "Résultat très éloigné de ce qui avait été demandé.",
  },
];

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function AdminQueueRail() {
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
          {APPLICATIONS.map((application) => (
            <li key={application.id}>
              <a
                href={`/admin/dossiers/${application.id}`}
                className="flex items-center gap-3 rounded-2xl bg-[#111c2e] p-3 transition-colors hover:bg-[#1a2b45]"
              >
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-[#1e2e45] text-[11px] font-bold text-[#f2f6fb]"
                >
                  {initials(`${application.firstName} ${application.lastName}`)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-[#f2f6fb]">
                    {application.salonName}
                  </p>
                  <p className="truncate text-xs text-[#93a6bc]">
                    {application.city} · {application.waitingDays} j
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
          {REPORTED_REVIEWS.map((review) => (
            <li key={review.id}>
              <a
                href={`/admin/avis/${review.id}`}
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
