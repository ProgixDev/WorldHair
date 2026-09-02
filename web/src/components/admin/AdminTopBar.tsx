"use client";

import { ADMIN_NAV_ITEMS } from "@/components/admin/adminNav";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/Sheet";
import { getAdminSession, signOutAdmin } from "@/services/adminAuth";
import { cn } from "@/lib/utils";
import { LogOut, Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function initialsFor(firstName: string, lastName: string, email: string): string {
  const fromName = `${firstName[0] ?? ""}${lastName[0] ?? ""}`;
  if (fromName) return fromName.toUpperCase();
  return (email[0] ?? "?").toUpperCase();
}

const MIN_QUERY_LENGTH = 1;

export function AdminTopBar({ title }: { title: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);
  const [initials, setInitials] = useState<string | null>(null);

  useEffect(() => {
    getAdminSession().then((session) => {
      if (session) setInitials(initialsFor(session.firstName, session.lastName, session.email));
    });
  }, []);

  const suggestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query.length < MIN_QUERY_LENGTH) return [];
    return ADMIN_NAV_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.keywords.some((keyword) => keyword.toLowerCase().includes(query)),
    ).slice(0, 6);
  }, [search]);

  const handleLogout = async () => {
    await signOutAdmin();
    router.replace("/login");
  };

  const goTo = (href: string) => {
    setSearch("");
    setFocused(false);
    router.push(href);
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (suggestions[0]) goTo(suggestions[0].href);
  };

  const showSuggestions = focused && search.trim().length >= MIN_QUERY_LENGTH;

  const form = (
    <form
      onSubmit={handleSearchSubmit}
      className="relative hidden max-w-sm flex-1 items-center md:flex"
    >
      <label className="sr-only" htmlFor="admin-topbar-search">
        Rechercher une fonctionnalité
      </label>
      <input
        id="admin-topbar-search"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete="off"
        placeholder="Rechercher une fonctionnalité..."
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
          {suggestions.map((item) => (
            <li key={item.href}>
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  goTo(item.href);
                }}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5",
                )}
              >
                <item.icon className="size-4 shrink-0 text-[#93a6bc]" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm text-[#f2f6fb]">
                  {item.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );

  return (
    <header className="flex items-center justify-between gap-3 px-4 pt-5 pb-2 md:gap-6 md:px-8 md:pt-7">
      {/* Below `md` the sidebar rail is hidden, so this is the only way
          between admin pages — labelled, unlike the icon-only rail. */}
      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Navigation"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-[#1e2e45] bg-[#111c2e] text-[#93a6bc] transition-colors hover:text-white md:hidden"
          >
            <Menu className="size-4" aria-hidden="true" />
          </button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-72 border-none bg-[#0c1524] p-0 text-[#f2f6fb]"
        >
          <SheetHeader>
            <SheetTitle className="text-[#f2f6fb]">Navigation</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-3 pb-4">
            {ADMIN_NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <SheetClose asChild key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors",
                      active
                        ? "bg-white text-[#0c2340]"
                        : "text-[#93a6bc] hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                </SheetClose>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-[#f2f6fb] uppercase md:flex-none md:text-2xl">
        {title}
      </h1>

      {form}

      <div className="flex shrink-0 items-center gap-2 md:gap-3">
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
          className="grid size-10 shrink-0 place-items-center rounded-full border border-[#1e2e45] bg-[#111c2e] text-[#93a6bc] transition-colors hover:text-white"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  );
}
