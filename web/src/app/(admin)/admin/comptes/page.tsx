"use client";

import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { cn } from "@/lib/utils";
import { type AdminAccount, listAccounts, setAccountStatus } from "@/services/adminApi";
import { Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
  const [role, setRole] = useState<AdminAccount["role"]>("particulier");
  const [search, setSearch] = useState("");
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

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
    load(role, search);
  }, [role, search, load]);

  const handleRoleChange = (next: AdminAccount["role"]) => {
    setLoading(true);
    setRole(next);
  };

  const handleSearchChange = (value: string) => {
    setLoading(true);
    setSearch(value);
  };

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

      <div className="min-w-0 flex-1 px-6 pt-4 pb-8 sm:px-8">
        <div className="rounded-3xl bg-[#080f1a] p-5 sm:p-6">
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

            <label className="flex items-center gap-2 rounded-full bg-[#111c2e] px-4 py-2">
              <Search className="size-4 text-[#5b7186]" aria-hidden="true" />
              <input
                type="text"
                value={search}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Rechercher par nom ou email"
                className="w-56 bg-transparent text-sm text-[#f2f6fb] placeholder:text-[#5b7186] focus:outline-none"
              />
            </label>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {loading && (
              <p className="py-8 text-center text-sm text-[#93a6bc]">Chargement…</p>
            )}
            {error && (
              <p className="py-8 text-center text-sm text-[#ff7a70]">{error}</p>
            )}
            {!loading && !error && accounts.length === 0 && (
              <p className="py-8 text-center text-sm text-[#93a6bc]">
                Aucun compte dans cette catégorie.
              </p>
            )}

            {accounts.map((account) => {
              const fullName = `${account.firstName} ${account.lastName}`.trim();
              const displayName = fullName || account.email;
              const initial = (fullName || account.email)[0]?.toUpperCase() ?? "?";
              const busy = actioningId === account.id;

              return (
                <div
                  key={account.id}
                  className="flex flex-wrap items-center gap-4 rounded-2xl bg-[#111c2e] p-4"
                >
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

                  <div className="flex gap-2">
                    {account.accountStatus !== "active" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSetStatus(account.id, "active")}
                        className="rounded-full bg-[#1f9d55] px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
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
                        className="rounded-full bg-[#b3261e] px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
                      >
                        Bannir
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
