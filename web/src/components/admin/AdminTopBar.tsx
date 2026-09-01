"use client";

import { getAdminSession, signOutAdmin } from "@/services/adminAuth";
import { Bell, LogOut, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function initialsFor(firstName: string, lastName: string, email: string): string {
  const fromName = `${firstName[0] ?? ""}${lastName[0] ?? ""}`;
  if (fromName) return fromName.toUpperCase();
  return (email[0] ?? "?").toUpperCase();
}

export function AdminTopBar({ title }: { title: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [initials, setInitials] = useState<string | null>(null);

  useEffect(() => {
    getAdminSession().then((session) => {
      if (session) setInitials(initialsFor(session.firstName, session.lastName, session.email));
    });
  }, []);

  const handleLogout = async () => {
    await signOutAdmin();
    router.replace("/login");
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const query = search.trim();
    router.push(query ? `/admin/comptes?search=${encodeURIComponent(query)}` : "/admin/comptes");
  };

  return (
    <header className="flex items-center justify-between gap-6 px-8 pt-7 pb-2">
      <h1 className="text-2xl font-medium text-[#f2f6fb]">{title}</h1>

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
      </form>

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
