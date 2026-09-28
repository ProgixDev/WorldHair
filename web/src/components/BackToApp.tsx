"use client";

import { useEffect } from "react";

/**
 * Hands straight back to the app at `href` (a worldhair:// link). The
 * button stays for a browser that blocks the automatic hand-off.
 */
export function BackToApp({ href }: { href: string }) {
  useEffect(() => {
    window.location.href = href;
  }, [href]);

  return (
    <a
      href={href}
      className="inline-flex h-11 items-center justify-center rounded-xl bg-[#2a93d5] px-6 text-sm font-medium text-white hover:bg-[#2a93d5]/90"
    >
      Retourner dans l&apos;application
    </a>
  );
}
