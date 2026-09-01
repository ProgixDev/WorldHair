"use client";

import { getAdminSession, signOutAdmin } from "@/services/adminAuth";
import { cn } from "@/lib/utils";
import {
  CreditCard,
  FileCheck2,
  Flag,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Newspaper,
  Search,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function initialsFor(firstName: string, lastName: string, email: string): string {
  const fromName = `${firstName[0] ?? ""}${lastName[0] ?? ""}`;
  if (fromName) return fromName.toUpperCase();
  return (email[0] ?? "?").toUpperCase();
}

interface Functionality {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra terms a page is found by, beyond its own label — mirrors AdminSidebar's NAV_ITEMS. */
  keywords: string[];
}

const FUNCTIONALITIES: Functionality[] = [
  {
    href: "/admin",
    label: "Tableau de bord",
    icon: LayoutDashboard,
    keywords: ["statistiques", "réservations", "vue d'ensemble", "dashboard"],
  },
  {
    href: "/admin/dossiers",
    label: "Dossiers coiffeurs",
    icon: FileCheck2,
    keywords: ["kbis", "rne", "diplôme", "pièce d'identité", "validation", "inscription"],
  },
  {
    href: "/admin/avis",
    label: "Avis signalés",
    icon: Flag,
    keywords: ["modération", "masquer un avis", "signalement", "commentaires"],
  },
  {
    href: "/admin/comptes",
    label: "Comptes",
    icon: Users,
    keywords: ["utilisateurs", "suspendre", "bannir", "profils", "particuliers"],
  },
  {
    href: "/admin/publicites",
    label: "Publicités",
    icon: Megaphone,
    keywords: ["bandeau", "bannière", "pop-up", "zones publicitaires", "ads"],
  },
  {
    href: "/admin/contenu",
    label: "Contenu",
    icon: Newspaper,
    keywords: ["onboarding", "slides", "textes", "application mobile"],
  },
  {
    href: "/admin/abonnements",
    label: "Abonnements",
    icon: CreditCard,
    keywords: ["coiffeur pro", "facturation", "plan", "essai"],
  },
  {
    href: "/admin/parametres",
    label: "Paramètres",
    icon: Settings,
    keywords: ["mot de passe", "email", "administrateurs", "créer un admin"],
  },
];

const MIN_QUERY_LENGTH = 1;

export function AdminTopBar({ title }: { title: string }) {
  const router = useRouter();
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
    return FUNCTIONALITIES.filter(
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
    <header className="flex items-center justify-between gap-6 px-8 pt-7 pb-2">
      <h1 className="text-2xl font-bold text-[#f2f6fb] uppercase">{title}</h1>

      {form}

      <div className="flex items-center gap-3">
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
