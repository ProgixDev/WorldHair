"use client";

import { useEffect } from "react";

/** The app's "Paiements" screen (mobile/src/app/pro/payments.tsx) — it reads the new status on arrival. */
const APP_URL = "worldhair://pro/payments";

/** Hands straight back to the app; the link stays for a browser that blocks the automatic hand-off. */
export function BackToApp() {
  useEffect(() => {
    window.location.href = APP_URL;
  }, []);

  return (
    <a
      href={APP_URL}
      className="inline-flex h-11 items-center justify-center rounded-xl bg-[#2a93d5] px-6 text-sm font-medium text-white hover:bg-[#2a93d5]/90"
    >
      Retourner dans l&apos;application
    </a>
  );
}
