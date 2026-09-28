"use client";

import { type CoiffeurSession, getCoiffeurSession } from "@/services/adminAuth";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

const CoiffeurSessionContext = createContext<CoiffeurSession | null>(null);

/** The signed-in coiffeur, inside ProAuthGuard. */
export function useCoiffeurSession(): CoiffeurSession {
  const session = useContext(CoiffeurSessionContext);
  if (!session) throw new Error("useCoiffeurSession must be used inside ProAuthGuard");
  return session;
}

/**
 * Client-side gate for the coiffeur pages, like AdminAuthGuard for the
 * back-office: nothing renders until a coiffeur session is confirmed; anyone
 * else goes to /login, which brings them back here afterwards.
 */
export function ProAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<CoiffeurSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCoiffeurSession().then((found) => {
      if (cancelled) return;
      if (!found) {
        const back = pathname + window.location.search;
        router.replace(`/login?next=${encodeURIComponent(back)}`);
        return;
      }
      setSession(found);
    });
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#17243a]">
        <p className="text-sm text-[#93a6bc]">Vérification…</p>
      </div>
    );
  }

  return <CoiffeurSessionContext.Provider value={session}>{children}</CoiffeurSessionContext.Provider>;
}
