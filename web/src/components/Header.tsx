import { Button } from "@/components/ui/Button";
import { Search, User } from "lucide-react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "#fonctionnalites", label: "Fonctionnalités" },
  { href: "#coiffeurs", label: "Coiffeurs" },
];

export function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-[#0c2340] text-white">
      <div className="mx-auto grid max-w-[1680px] grid-cols-3 items-center px-4 py-4 sm:px-6">
        <nav className="hidden items-center gap-7 sm:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-xs tracking-wide text-white/70 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <Link
          href="/"
          className="font-heading col-start-2 text-center text-lg tracking-[0.2em] text-white uppercase"
        >
          WorldHair
        </Link>

        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Rechercher"
            className="text-white hover:bg-white/10 hover:text-white"
          >
            <Search className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Compte"
            className="text-white hover:bg-white/10 hover:text-white"
          >
            <User className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
