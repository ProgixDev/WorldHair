"use client";

import { cn } from "@/lib/utils";
import {
  CreditCard,
  FileCheck2,
  Flag,
  LayoutDashboard,
  Megaphone,
  Newspaper,
  Settings,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Every entry maps to a line under TODO.md's "## Admin". */
const NAV_ITEMS = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/dossiers", label: "Dossiers coiffeurs", icon: FileCheck2 },
  { href: "/admin/avis", label: "Avis signalés", icon: Flag },
  { href: "/admin/comptes", label: "Comptes", icon: Users },
  { href: "/admin/publicites", label: "Publicités", icon: Megaphone },
  { href: "/admin/contenu", label: "Contenu", icon: Newspaper },
  { href: "/admin/abonnements", label: "Abonnements", icon: CreditCard },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  // sticky + h-screen + self-start: the rail is tied to the viewport, not to
  // the page's height — a long list page must not stretch it (and drag the
  // centred nav off-screen with it).
  return (
    <aside className="sticky top-0 flex h-screen w-20 shrink-0 flex-col items-center self-start">
      {/* Mirrors AdminTopBar's header box exactly — same pt-7/pb-2, and an
          h-11 row (the height its search input gives that row) — so the logo
          and the page title share a vertical centre. */}
      <div className="flex justify-center pt-7 pb-2">
        <Link href="/admin" aria-label="Tableau de bord" className="flex h-11 items-center">
          <Image src="/Logo.png" alt="" width={44} height={44} />
        </Link>
      </div>

      {/* Taken out of the flow so the logo slot above doesn't push it down —
          the rail centres on the page, not on the space left under the logo. */}
      <nav className="absolute top-1/2 flex -translate-y-1/2 flex-col items-center gap-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              title={item.label}
              className={cn(
                "grid size-11 place-items-center rounded-2xl transition-colors",
                active
                  ? "bg-white text-[#0c2340]"
                  : "text-[#93a6bc] hover:bg-white/5 hover:text-white",
              )}
            >
              <item.icon className="size-5" />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
