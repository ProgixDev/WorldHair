"use client";

import { getAdminSession } from "@/services/adminAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Status = "checking" | "authorized";

/**
 * Client-side gate — this app has no server-side session middleware (auth is
 * client-driven via Supabase everywhere else in this project too). Blocks
 * the sidebar/page from rendering until a real admin session is confirmed;
 * anything else redirects to /login.
 */
export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;

    getAdminSession().then((session) => {
      if (cancelled) return;
      if (!session) {
        router.replace("/login");
        return;
      }
      setStatus("authorized");
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#17243a]">
        <p className="text-sm text-[#93a6bc]">Vérification…</p>
      </div>
    );
  }

  return <>{children}</>;
}
