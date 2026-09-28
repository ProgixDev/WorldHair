"use client";

import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { Pagination } from "@/components/admin/Pagination";
import {
  APPOINTMENT_STATUS_STYLES,
  STATUS_FILTERS,
  appointmentQuery,
  appointmentStatusLabel,
  filtersFromSearch,
  filtersToSearch,
} from "@/lib/appointments";
import { PAYMENT_STATE_STYLES, paymentState } from "@/lib/payments";
import { cn } from "@/lib/utils";
import { type AdminAppointment, type AdminAppointmentFilters, listAdminAppointments } from "@/services/adminApi";
import { ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

const PAGE_SIZE = 20;
/** Typing waits this long before asking the server. */
const DEBOUNCE_MS = 300;

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const startsAt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

const fieldClass =
  "h-10 w-full min-w-0 rounded-full bg-[#111c2e] px-4 text-sm text-[#f2f6fb] placeholder:text-[#5b7186] focus:outline-2 focus:outline-[#2a93d5]";

export default function AdminRendezVousPage() {
  return (
    <Suspense fallback={null}>
      <AdminRendezVousPageContent />
    </Suspense>
  );
}

/**
 * Every booking (TODO.md Phase 7), filtered and paged by the server — a
 * booking opens in full, where it can be cancelled to settle a dispute. The
 * filters live in the address, so coming back from a booking finds the
 * same list.
 */
function AdminRendezVousPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<AdminAppointmentFilters>(() =>
    filtersFromSearch(new URLSearchParams(searchParams.toString())),
  );
  const [page, setPage] = useState(() => Math.max(1, Math.floor(Number(searchParams.get("page"))) || 1));
  const [result, setResult] = useState<{ items: AdminAppointment[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const request = ++latest.current;
    const timer = setTimeout(() => {
      const search = new URLSearchParams(filtersToSearch(filters));
      if (page > 1) search.set("page", String(page));
      const query = search.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });

      listAdminAppointments(appointmentQuery(filters, page, PAGE_SIZE))
        .then((data) => {
          if (latest.current !== request) return;
          setResult(data);
          setError(null);
        })
        .catch(() => {
          if (latest.current === request) setError("Impossible de charger les rendez-vous.");
        })
        .finally(() => {
          if (latest.current === request) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters, page, pathname, router]);

  // Any new filter lists from the first page — page 3 of a one-page result shows nothing.
  const change = (patch: Partial<AdminAppointmentFilters>) => {
    setLoading(true);
    setPage(1);
    setFilters((current) => ({ ...current, ...patch }));
  };

  const changePage = (next: number) => {
    setLoading(true);
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const filtered = Object.values(filters).some((value) => value);

  return (
    <>
      <AdminTopBar title="Rendez-vous" />

      <div className="min-w-0 flex-1 px-4 pt-4 pb-8 sm:px-8">
        <div className="flex flex-col gap-4 rounded-3xl bg-[#080f1a] p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <select
              value={filters.status ?? ""}
              onChange={(event) =>
                change({ status: (event.target.value || undefined) as AdminAppointmentFilters["status"] })
              }
              aria-label="Statut"
              className={fieldClass}
            >
              <option value="">Tous les statuts</option>
              {STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {(
              [
                { key: "salon", label: "Salon" },
                { key: "client", label: "Client" },
              ] as const
            ).map((field) => (
              <label key={field.key} className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[#5b7186]"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={filters[field.key] ?? ""}
                  onChange={(event) => change({ [field.key]: event.target.value })}
                  placeholder={field.label}
                  aria-label={field.label}
                  maxLength={100}
                  className={cn(fieldClass, "pl-10")}
                />
              </label>
            ))}

            {(
              [
                { key: "from", label: "Du" },
                { key: "to", label: "Au" },
              ] as const
            ).map((field) => (
              <label key={field.key} className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-xs text-[#93a6bc]">{field.label}</span>
                <input
                  type="date"
                  value={filters[field.key] ?? ""}
                  onChange={(event) => change({ [field.key]: event.target.value || undefined })}
                  aria-label={field.key === "from" ? "À partir du" : "Jusqu'au"}
                  className={cn(fieldClass, "[color-scheme:dark]")}
                />
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[#93a6bc]">
              {loading && result.items.length === 0
                ? "Chargement…"
                : `${result.total} rendez-vous${filtered ? " avec ces filtres" : ""}`}
            </p>
            {filtered && (
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setPage(1);
                  setFilters({});
                }}
                className="text-xs text-[#2a93d5] hover:text-white"
              >
                Effacer les filtres
              </button>
            )}
          </div>

          {error && <p className="py-8 text-center text-sm text-[#ff7a70]">{error}</p>}
          {!loading && !error && result.items.length === 0 && (
            <p className="py-8 text-center text-sm text-[#93a6bc]">Aucun rendez-vous.</p>
          )}

          {!error && result.items.length > 0 && (
            <ul className={cn("flex flex-col gap-3 transition-opacity", loading && "opacity-60")}>
              {result.items.map((appointment) => {
                const state = appointment.payment ? paymentState(appointment.payment) : null;
                return (
                  <li key={appointment.id}>
                    <Link
                      href={`/admin/rendez-vous/${appointment.id}`}
                      className="flex flex-col gap-3 rounded-2xl bg-[#111c2e] p-4 transition-colors hover:bg-[#16243a] sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#f2f6fb]">
                          {appointment.client.name} → {appointment.salon.name}
                        </p>
                        <p className="truncate text-xs text-[#93a6bc]">
                          {startsAt.format(new Date(appointment.startsAt))} · {appointment.serviceName}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <span className="text-sm font-medium text-[#f2f6fb]">{euros.format(appointment.price)}</span>
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-medium",
                            APPOINTMENT_STATUS_STYLES[appointment.status],
                          )}
                        >
                          {appointmentStatusLabel(appointment)}
                        </span>
                        {state ? (
                          <span className={cn("rounded-full px-3 py-1 text-xs font-medium", PAYMENT_STATE_STYLES[state])}>
                            {state}
                          </span>
                        ) : (
                          <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-[#5b7186]">
                            Sans paiement en ligne
                          </span>
                        )}
                        <ChevronRight className="hidden size-4 text-[#5b7186] sm:block" aria-hidden="true" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {!error && (
            <Pagination page={page} total={result.total} pageSize={PAGE_SIZE} onPageChange={changePage} />
          )}
        </div>
      </div>
    </>
  );
}
