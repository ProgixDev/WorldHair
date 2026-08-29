import { Button } from "@/components/ui/Button";
import { Search, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const NAV_LINKS = [
  { href: "#fonctionnalites", label: "Fonctionnalités" },
  { href: "#coiffeurs", label: "Coiffeurs" },
];

export function Header() {
  return (
    <header className="border-border bg-background/95 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-3 items-center px-4 sm:px-6">
        <nav className="hidden items-center gap-6 sm:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-foreground/80 hover:text-foreground text-sm font-medium transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <Link href="/" className="col-start-2 flex items-center justify-center gap-2">
          <Image src="/Logo.png" alt="WorldHair" width={28} height={28} />
          <span className="font-heading text-lg font-semibold">WorldHair</span>
        </Link>

        <div className="flex items-center justify-end gap-1.5">
          <Button variant="ghost" size="icon" aria-label="Rechercher">
            <Search />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Compte">
            <User />
          </Button>
        </div>
      </div>
    </header>
  );
}
