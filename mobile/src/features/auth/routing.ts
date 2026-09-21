import type { Session } from "../../services/auth";
import { getSignupIntent } from "../../services/preferences";

/** Every route the onboarding/auth gate can send the user to. */
export const ROUTES = {
  onboarding: "/onboarding",
  signIn: "/auth/sign-in",
  signUp: "/auth/sign-up",
  verifyEmail: "/auth/verify-email",
  profileSetup: "/auth/profile-setup",
  proIdentity: "/auth/pro/identity",
  proSalon: "/auth/pro/salon",
  proZone: "/auth/pro/zone",
  proDocuments: "/auth/pro/documents",
  pending: "/auth/pending",
  /** Mandatory shop-profile completion, once per coiffeur (issue #7). */
  proShopSetup: "/pro-shop-setup",
  /** Particulier shell (map tab). */
  discover: "/discover",
  search: "/search",
  appointments: "/appointments",
  profile: "/profile",
  /** Coiffeur shell. */
  proDashboard: "/pro/dashboard",
  proAgenda: "/pro/agenda",
  proSalonPage: "/pro/salon",
  proReviews: "/pro/reviews",
  proAccount: "/pro/account",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * The single source of truth for "where does this user belong right now".
 * Pure, so the gate can be reasoned about without mounting a navigator.
 */
export function nextRouteForSession(
  session: Session | null,
  onboardingSeen: boolean,
): AppRoute {
  if (!onboardingSeen) return ROUTES.onboarding;
  if (!session) return ROUTES.signIn;
  if (!session.emailVerified) return ROUTES.verifyEmail;

  if (session.role === "coiffeur") {
    if (session.status === "pending_review" || session.status === "rejected")
      return ROUTES.pending;
    if (session.status === "active")
      return session.shopProfileComplete
        ? ROUTES.proDashboard
        : ROUTES.proShopSetup;
    return ROUTES.proIdentity;
  }

  if (!session.profile) return ROUTES.profileSetup;
  return ROUTES.discover;
}

/**
 * Same decision as nextRouteForSession, plus resuming an in-progress
 * coiffeur signup — the DB role only flips from "particulier" to "coiffeur"
 * once the application is actually *submitted* (see services/auth.ts's doc
 * comment), so a verified account that picked "Coiffeur" at signup but never
 * finished the 4-step wizard (e.g. the app was killed mid-flow, before step
 * 4's submit) still looks, to nextRouteForSession alone, like a plain
 * particulier with no profile — landing on particulier profile-setup
 * instead of resuming the wizard, silently abandoning the coiffeur intent.
 *
 * `signupIntent` is the one signal that survives that: written at signup,
 * and — unlike before — no longer cleared right after email verification,
 * only once the application is truly submitted (see auth/pro/documents.tsx).
 * Kept as a separate async wrapper rather than folded into
 * nextRouteForSession itself so that function stays pure and callable
 * without a navigator or storage — see its own doc comment.
 */
export async function resolveNextRoute(
  session: Session | null,
  onboardingSeen: boolean,
): Promise<AppRoute> {
  const defaultRoute = nextRouteForSession(session, onboardingSeen);
  if (defaultRoute !== ROUTES.profileSetup) return defaultRoute;

  const intent = await getSignupIntent();
  return intent === "coiffeur" ? ROUTES.proIdentity : defaultRoute;
}
