import type { Session } from "../../services/auth";
import { nextRouteForSession, ROUTES, type AppRoute } from "../auth/routing";

/** What the « code de fin » link does for the account that opened it. */
export type PresenceLinkDecision =
  /** A client whose account is ready: confirm with the server now. */
  | { action: "confirm" }
  /** Not ready yet (signed out, email unchecked, no names): keep the code and go `route`; the client shell resumes it. */
  | { action: "later"; route: AppRoute }
  /** A salon's account: the link is for clients; stay (go back) at home, the code dropped. */
  | { action: "not-for-you"; route: AppRoute };

/**
 * Where the QR code's link (« worldhair://rdv/CODE ») takes this account.
 * Pure, like routeForInviteLink: only a client whose account is complete
 * ends up on the discover map, which is the moment it can confirm.
 */
export function routeForPresenceLink(session: Session | null): PresenceLinkDecision {
  const route = nextRouteForSession(session, true);
  if (!session || session.role !== "particulier") {
    return session ? { action: "not-for-you", route } : { action: "later", route };
  }
  return route === ROUTES.discover ? { action: "confirm" } : { action: "later", route };
}
