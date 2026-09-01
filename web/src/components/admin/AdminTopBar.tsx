"use client";

import { type AdminAccount, listAccounts } from "@/services/adminApi";
import { getAdminSession, signOutAdmin } from "@/services/adminAuth";
import { cn } from "@/lib/utils";
import { Bell, LogOut, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function initialsFor(firstName: string, lastName: string, email: string): string {
  const fromName = `${firstName[0] ?? ""}${lastName[0] ?? ""}`;
  if (fromName) return fromName.toUpperCase();
  return (email[0] ?? "?").toUpperCase();
}

const ROLE_LABELS: Record<AdminAccount["role"], string> = {
  particulier: "Particulier",
  coiffeur: "Coiffeur",
};

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

export function AdminTopBar({ title }: { title: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<AdminAccount[]>([]);
  const [initials, setInitials] = useState<string | null>(null);

  useEffect(() => {
    getAdminSession().then((session) => {
      if (session) setInitials(initialsFor(session.firstName, session.lastName, session.email));
    });
  }, []);

  useEffect(() => {
    const query = search.trim();
    if (query.length < MIN_QUERY_LENGTH) return;

    const timeoutId = setTimeout(() => {
      listAccounts(undefined, query)
        .then((accounts) => setSuggestions(accounts.slice(0, 6)))
        .catch(() => setSuggestions([]));
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [search]);

  const handleLogout = async () => {
    await signOutAdmin();
    router.replace("/login");
  };

  const goToAccount = (query: string, role?: AdminAccount["role"]) => {
    setSearch("");
    setSuggestions([]);
    setFocused(false);
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    if (role) params.set("role", role);
    const queryString = params.toString();
    router.push(queryString ? `/admin/comptes?${queryString}` : "/admin/comptes");
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    goToAccount(search.trim());
  };

  const showSuggestions = focused && search.trim().length >= MIN_QUERY_LENGTH;

  const form = (
    <form
      onSubmit={handleSearchSubmit}
      className="relative hidden max-w-sm flex-1 items-center md:flex"
    >
      <label className="sr-only" htmlFor="admin-topbar-search">
        Rechercher un compte
      </label>
      <input
        id="admin-topbar-search"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete="off"
        placeholder="Rechercher un compte..."
        className="h-11 w-full rounded-full border border-[#1e2e45] bg-[#111c2e] pr-11 pl-5 text-sm text-[#f2f6fb] placeholder:text-[#93a6bc] focus:border-[#2a93d5] focus:outline-none"
      />
      <button
        type="submit"
        aria-label="Rechercher"
        className="absolute right-4 text-[#93a6bc] hover:text-white"
      >
        <Search className="size-4" aria-hidden="true" />
      </button>

      {showSuggestions && (
        <ul className="absolute top-full left-0 z-10 mt-2 w-full overflow-hidden rounded-2xl border border-[#1e2e45] bg-[#111c2e] py-1 shadow-xl">
          {suggestions.length === 0 && (
            <li className="px-4 py-2.5 text-xs text-[#93a6bc]">Aucun résultat.</li>
          )}
          {suggestions.map((account) => {
            const fullName = `${account.firstName} ${account.lastName}`.trim();
            return (
              <li key={account.id}>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    goToAccount(account.email, account.role);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-[#f2f6fb]">
                    {fullName || account.email}
                  </span>
                  <span className="shrink-0 text-[10px] text-[#5b7186]">
                    {ROLE_LABELS[account.role]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </form>
  );

  return (
    <header className="flex items-center justify-between gap-6 px-8 pt-7 pb-2">
      <h1 className="text-2xl font-bold text-[#f2f6fb] uppercase">{title}</h1>

      {form}

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Notifications"
          className="grid size-10 place-items-center rounded-full border border-[#1e2e45] bg-[#111c2e] text-[#93a6bc] transition-colors hover:text-white"
        >
          <Bell className="size-4" />
        </button>
        <div
          aria-hidden="true"
          className="grid size-10 place-items-center rounded-full bg-[#111c2e] text-xs font-bold text-[#f2f6fb]"
        >
          {initials ?? "…"}
        </div>
        <button
          type="button"
          aria-label="Se déconnecter"
          onClick={handleLogout}
          className="grid size-10 place-items-center rounded-full border border-[#1e2e45] bg-[#111c2e] text-[#93a6bc] transition-colors hover:text-white"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  );
}
