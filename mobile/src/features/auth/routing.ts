import type { Session } from "../../services/auth";

/** Every route the onboarding/auth gate can send the user to. */
export const ROUTES = {
  onboarding: "/onboarding",
  signIn: "/auth/sign-in",
  signUp: "/auth/sign-up",
  verifyEmail: "/auth/verify-email",
  profileSetup: "/auth/profile-setup",
  proIdentity: "/auth/pro/identity",
  proSalon: "/auth/pro/salon",
  proDocuments: "/auth/pro/documents",
  pending: "/auth/pending",
  home: "/home",
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
    if (session.status === "active") return ROUTES.home;
    return ROUTES.proIdentity;
  }

  if (!session.profile) return ROUTES.profileSetup;
  return ROUTES.home;
}
