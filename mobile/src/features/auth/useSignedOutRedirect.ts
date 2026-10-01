import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { ROUTES } from "./routing";

/**
 * Back to sign-in whenever the session ends under the user — the server
 * refused it (account deleted, token revoked, see lib/apiClient.ts) — so a
 * screen isn't left loading forever. A deliberate sign-out already goes
 * there; going again is harmless.
 */
export function useSignedOutRedirect(signedIn: boolean) {
  const router = useRouter();
  const wasSignedIn = useRef(signedIn);

  useEffect(() => {
    if (wasSignedIn.current && !signedIn) router.replace(ROUTES.signIn as never);
    wasSignedIn.current = signedIn;
  }, [signedIn, router]);
}
