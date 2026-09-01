"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Search, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const NAV_LINKS = [
  { href: "#fonctionnalites", label: "Fonctionnalités" },
  { href: "#coiffeurs", label: "Coiffeurs" },
  { href: "#parcours", label: "Comment ça marche" },
  { href: "#avis", label: "Avis" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 text-white transition-colors duration-300",
        scrolled ? "bg-[#0c2340]" : "bg-transparent",
      )}
    >
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
            asChild
            variant="ghost"
            size="icon"
            aria-label="Compte"
            className="text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="/login">
              <User className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
