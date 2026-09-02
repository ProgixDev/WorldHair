"use client";

import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { Pagination, pageSlice } from "@/components/admin/Pagination";
import { cn } from "@/lib/utils";
import { type AdminAccount, listAccounts, setAccountStatus } from "@/services/adminApi";
import { Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

const ROLE_TABS = [
  { value: "particulier", label: "Particuliers" },
  { value: "coiffeur", label: "Coiffeurs" },
] as const;

const STATUS_STYLES: Record<AdminAccount["accountStatus"], string> = {
  active: "bg-[#1f9d55]/15 text-[#1f9d55]",
  suspended: "bg-[#e4b980]/15 text-[#e4b980]",
  banned: "bg-[#ff7a70]/15 text-[#ff7a70]",
};

const STATUS_LABELS: Record<AdminAccount["accountStatus"], string> = {
  active: "Actif",
  suspended: "Suspendu",
  banned: "Banni",
};

export default function AdminComptesPage() {
  return (
    <Suspense fallback={null}>
      <AdminComptesPageContent />
    </Suspense>
  );
}

function AdminComptesPageContent() {
  const searchParams = useSearchParams();
  const [role, setRole] = useState<AdminAccount["role"]>(
    () => (searchParams.get("role") === "coiffeur" ? "coiffeur" : "particulier"),
  );
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  // Set when arriving from a link that knows the exact account (e.g. dossiers'
  // "Voir le profil") — a coiffeur's profiles.first_name/last_name are always
  // blank (their identity lives in coiffeur_applications instead), so a name
  // search can never find them; matching by id is the only reliable way in.
  const [focusId, setFocusId] = useState(() => searchParams.get("id"));
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback((nextRole: AdminAccount["role"], nextSearch: string) => {
    listAccounts(nextRole, nextSearch.trim() || undefined)
      .then((data) => {
        setAccounts(data);
        setError(null);
      })
      .catch(() => setError("Impossible de charger les comptes."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Ignore the text search while focusing a specific account by id.
    load(role, focusId ? "" : search);
  }, [role, search, focusId, load]);

  // Changing tab or query re-pages from the top — otherwise you can land on
  // page 3 of a one-page result and see nothing.
  const handleRoleChange = (next: AdminAccount["role"]) => {
    setLoading(true);
    setPage(1);
    setFocusId(null);
    setRole(next);
  };

  const handleSearchChange = (value: string) => {
    setLoading(true);
    setPage(1);
    setFocusId(null);
    setSearch(value);
  };

  const visibleAccounts = focusId
    ? accounts.filter((account) => account.id === focusId)
    : accounts;

  const handleSetStatus = async (id: string, status: AdminAccount["accountStatus"]) => {
    setActioningId(id);
    try {
      await setAccountStatus(id, status);
      await load(role, search);
    } finally {
      setActioningId(null);
    }
  };

  return (
    <>
      <AdminTopBar title="Comptes" />

      <div className="min-w-0 flex-1 px-4 pt-4 pb-8 sm:px-8">
        <div className="rounded-3xl bg-[#080f1a] p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              {ROLE_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => handleRoleChange(tab.value)}
                  className={cn(
                    "text-sm transition-colors",
                    role === tab.value
                      ? "border-b-2 border-[#2a93d5] pb-1 font-medium text-[#f2f6fb]"
                      : "text-[#93a6bc] hover:text-white",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <label className="flex w-full items-center gap-2 rounded-full bg-[#111c2e] px-4 py-2 sm:w-auto">
              <Search className="size-4 shrink-0 text-[#5b7186]" aria-hidden="true" />
              <input
                type="text"
                value={search}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Rechercher par nom ou email"
                className="w-full min-w-0 bg-transparent text-sm text-[#f2f6fb] placeholder:text-[#5b7186] focus:outline-none sm:w-56"
              />
            </label>
          </div>

          {focusId && (
            <button
              type="button"
              onClick={() => setFocusId(null)}
              className="mt-4 text-xs text-[#2a93d5] hover:text-white"
            >
              ← Voir tous les comptes
            </button>
          )}

          <div className="mt-6 flex flex-col gap-3">
            {loading && (
              <p className="py-8 text-center text-sm text-[#93a6bc]">Chargement…</p>
            )}
            {error && (
              <p className="py-8 text-center text-sm text-[#ff7a70]">{error}</p>
            )}
            {!loading && !error && visibleAccounts.length === 0 && (
              <p className="py-8 text-center text-sm text-[#93a6bc]">
                Aucun compte dans cette catégorie.
              </p>
            )}

            {!loading &&
              !error &&
              pageSlice(visibleAccounts, page).map((account) => {
              const fullName = `${account.firstName} ${account.lastName}`.trim();
              const displayName = fullName || account.email;
              const initial = (fullName || account.email)[0]?.toUpperCase() ?? "?";
              const busy = actioningId === account.id;

              return (
                // Stacked on phones: as one wrapping row the name/email column
                // was the only flexible child, so it collapsed to a couple of
                // truncated characters while the pill, date and three buttons
                // kept their intrinsic widths. Identity gets its own full line.
                <div
                  key={account.id}
                  className="flex flex-col gap-3 rounded-2xl bg-[#111c2e] p-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3 sm:flex-1 sm:gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#1e2e45] text-xs font-bold text-[#f2f6fb]">
                      {initial}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#f2f6fb]">
                        {displayName}
                      </p>
                      {fullName && (
                        <p className="truncate text-xs text-[#93a6bc]">{account.email}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4">
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        STATUS_STYLES[account.accountStatus],
                      )}
                    >
                      {STATUS_LABELS[account.accountStatus]}
                    </span>
                    <span className="text-xs text-[#93a6bc]">
                      {new Date(account.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                    <Link
                      href={`/admin/comptes/${account.id}`}
                      aria-label="Voir le profil"
                      title="Voir le profil"
                      className="grid size-8 shrink-0 place-items-center rounded-full text-[#93a6bc] transition-colors hover:bg-white/5 hover:text-white"
                    >
                      <UserRound className="size-4" aria-hidden="true" />
                    </Link>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {account.accountStatus !== "active" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSetStatus(account.id, "active")}
                        className="rounded-full bg-[#1f9d55] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#1a8549] disabled:opacity-50"
                      >
                        Réactiver
                      </button>
                    )}
                    {account.accountStatus !== "suspended" && account.accountStatus !== "banned" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSetStatus(account.id, "suspended")}
                        className="rounded-full bg-white/10 px-4 py-2 text-xs text-[#e4b980] hover:text-[#e4b980]/80 disabled:opacity-50"
                      >
                        Suspendre
                      </button>
                    )}
                    {account.accountStatus !== "banned" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSetStatus(account.id, "banned")}
                        className="rounded-full bg-[#b3261e] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#921f18] disabled:opacity-50"
                      >
                        Bannir
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {!loading && !error && (
              <Pagination page={page} total={visibleAccounts.length} onPageChange={setPage} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
