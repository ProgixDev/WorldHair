import type { Session } from "../../services/auth";
import { ROUTES } from "../auth/routing";
import { routeForPresenceLink } from "./linking";

jest.mock("../../services/preferences", () => ({ getSignupIntent: jest.fn() }));
jest.mock("../../lib/supabase", () => ({ supabase: {} }));
jest.mock("../../lib/apiClient", () => ({ apiClient: {} }));

const PROFILE = { firstName: "Camille", lastName: "Durand", photoUri: null };

function session(overrides: Partial<Session> = {}): Session {
  return {
    userId: "u1",
    email: "camille@example.com",
    role: "particulier",
    status: "active",
    emailVerified: true,
    profile: PROFILE,
    application: null,
    reviewMessage: null,
    createdAt: "2026-10-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("routeForPresenceLink (« code de fin »)", () => {
  it("sends someone signed out to sign in first, the code kept", () => {
    expect(routeForPresenceLink(null)).toEqual({ action: "later", route: ROUTES.signIn });
  });

  it("confirms right away for a client whose account is ready", () => {
    expect(routeForPresenceLink(session())).toEqual({ action: "confirm" });
  });

  it("keeps the code while a client finishes their account (email check, names)", () => {
    expect(routeForPresenceLink(session({ emailVerified: false, status: "pending_email" }))).toEqual({
      action: "later",
      route: ROUTES.verifyEmail,
    });
    expect(routeForPresenceLink(session({ profile: null, status: "profile_incomplete" }))).toEqual({
      action: "later",
      route: ROUTES.profileSetup,
    });
  });

  it("tells a salon account the link is for clients and keeps it at home", () => {
    expect(routeForPresenceLink(session({ role: "coiffeur", shopProfileComplete: true }))).toEqual({
      action: "not-for-you",
      route: ROUTES.proDashboard,
    });
    expect(
      routeForPresenceLink(
        session({ role: "staff", staffMembership: { staffId: "s1", salonId: "salon1", salonName: "Maison Tresse" } }),
      ),
    ).toEqual({ action: "not-for-you", route: ROUTES.staffAgenda });
  });
});
