"use client";

import { cn } from "@/lib/utils";
import {
  CreditCard,
  FileCheck2,
  Flag,
  LayoutDashboard,
  Megaphone,
  Settings,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Every entry maps to a line under TODO.md's "## Admin". Only `/admin` and the
 * two queues backed by real endpoints are reachable today — the rest are
 * declared here so the rail is the real navigation from the start rather than
 * something that gets rebuilt once those pages land.
 */
const NAV_ITEMS = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/dossiers", label: "Dossiers coiffeurs", icon: FileCheck2 },
  { href: "/admin/avis", label: "Avis signalés", icon: Flag },
  { href: "/admin/comptes", label: "Comptes", icon: Users },
  { href: "/admin/publicites", label: "Publicités", icon: Megaphone },
  { href: "/admin/abonnements", label: "Abonnements", icon: CreditCard },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-20 shrink-0 flex-col items-center gap-8 py-6">
      <Link href="/" className="flex flex-col items-center gap-1.5">
        <Image src="/Logo.png" alt="WorldHair" width={28} height={28} />
        <span className="text-[8px] font-bold tracking-[0.18em] text-white/70 uppercase">
          WorldHair
        </span>
      </Link>

      <nav className="flex flex-col items-center gap-3">
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
