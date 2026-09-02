"use client";

import { Button } from "@/components/ui/Button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/Sheet";
import { cn } from "@/lib/utils";
import { Menu, Search, User } from "lucide-react";
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
        <div className="flex items-center">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Menu"
                className="size-10 text-white hover:bg-white/10 hover:text-white sm:hidden"
              >
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-4/5 border-none bg-[#0c2340] text-white sm:max-w-xs"
            >
              <SheetHeader>
                <SheetTitle className="font-heading tracking-[0.2em] text-white uppercase">
                  WorldHair
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4">
                {NAV_LINKS.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <a
                      href={link.href}
                      className="rounded-lg px-3 py-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      {link.label}
                    </a>
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

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
        </div>

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
            className="size-10 text-white hover:bg-white/10 hover:text-white sm:size-9"
          >
            <Search className="size-4" />
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="Compte"
            className="size-10 text-white hover:bg-white/10 hover:text-white sm:size-9"
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
