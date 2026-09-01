"use client";

import { signOutAdmin } from "@/services/adminAuth";
import { Bell, LogOut, Search } from "lucide-react";
import { useRouter } from "next/navigation";

export function AdminTopBar({ title }: { title: string }) {
  const router = useRouter();

  const handleLogout = async () => {
    await signOutAdmin();
    router.replace("/login");
  };

  return (
    <header className="flex items-center justify-between gap-6 px-8 pt-7 pb-2">
      <h1 className="text-2xl font-medium text-[#f2f6fb]">{title}</h1>

      <label className="relative hidden max-w-sm flex-1 items-center md:flex">
        <span className="sr-only">Rechercher</span>
        <input
          type="search"
          placeholder="Rechercher..."
          className="h-11 w-full rounded-full border border-[#1e2e45] bg-[#111c2e] pr-11 pl-5 text-sm text-[#f2f6fb] placeholder:text-[#93a6bc] focus:border-[#2a93d5] focus:outline-none"
        />
        <Search
          className="absolute right-4 size-4 text-[#93a6bc]"
          aria-hidden="true"
        />
      </label>

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
          AD
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
