import type { Session } from "../../services/auth";
import { getSignupIntent } from "../../services/preferences";
import { nextRouteForSession, resolveNextRoute, routeForInviteLink, ROUTES } from "./routing";

jest.mock("../../services/preferences", () => ({ getSignupIntent: jest.fn() }));
jest.mock("../../lib/supabase", () => ({ supabase: {} }));
jest.mock("../../lib/apiClient", () => ({ apiClient: {} }));

const mockedIntent = getSignupIntent as jest.Mock;

const PROFILE = { firstName: "Camille", lastName: "Durand", photoUri: null };
const MEMBERSHIP = { staffId: "s1", salonId: "salon1", salonName: "Maison Tresse" };

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

describe("nextRouteForSession", () => {
  it("starts with the onboarding, then sign-in, then the email check", () => {
    expect(nextRouteForSession(session(), false)).toBe(ROUTES.onboarding);
    expect(nextRouteForSession(null, true)).toBe(ROUTES.signIn);
    expect(nextRouteForSession(session({ emailVerified: false, status: "pending_email" }), true)).toBe(
      ROUTES.verifyEmail,
    );
  });

  it("sends a client to their profile first, then the map", () => {
    expect(nextRouteForSession(session({ profile: null, status: "profile_incomplete" }), true)).toBe(
      ROUTES.profileSetup,
    );
    expect(nextRouteForSession(session(), true)).toBe(ROUTES.discover);
  });

  it("sends a salon owner through his dossier to his dashboard", () => {
    const coiffeur = (overrides: Partial<Session>) => session({ role: "coiffeur", profile: null, ...overrides });
    expect(nextRouteForSession(coiffeur({ status: "profile_incomplete" }), true)).toBe(ROUTES.proIdentity);
    expect(nextRouteForSession(coiffeur({ status: "pending_review" }), true)).toBe(ROUTES.pending);
    expect(nextRouteForSession(coiffeur({ status: "active", shopProfileComplete: false }), true)).toBe(
      ROUTES.proShopSetup,
    );
    expect(nextRouteForSession(coiffeur({ status: "active", shopProfileComplete: true }), true)).toBe(
      ROUTES.proDashboard,
    );
  });

  it("sends a staff member to their agenda, never to the client or salon areas", () => {
    expect(nextRouteForSession(session({ role: "staff", staffMembership: MEMBERSHIP }), true)).toBe(
      ROUTES.staffAgenda,
    );
  });

  it("asks a staff member without a profile for it first", () => {
    expect(
      nextRouteForSession(
        session({ role: "staff", profile: null, status: "profile_incomplete", staffMembership: MEMBERSHIP }),
        true,
      ),
    ).toBe(ROUTES.profileSetup);
  });

  it("sends a staff member no longer in a salon (removed, or left) to join one", () => {
    expect(nextRouteForSession(session({ role: "staff", staffMembership: null }), true)).toBe(ROUTES.joinSalon);
  });

  // The server couldn't be asked: their agenda says so and lets them retry, rather than a join screen they don't need.
  it("keeps a staff member whose salon couldn't be read on their agenda", () => {
    expect(nextRouteForSession(session({ role: "staff", staffMembership: undefined }), true)).toBe(
      ROUTES.staffAgenda,
    );
  });
});

describe("resolveNextRoute", () => {
  beforeEach(() => mockedIntent.mockReset());

  it("resumes the salon dossier for an account that picked « Créer mon salon »", async () => {
    mockedIntent.mockResolvedValue("coiffeur");
    await expect(resolveNextRoute(session({ profile: null, status: "profile_incomplete" }), true)).resolves.toBe(
      ROUTES.proIdentity,
    );
  });

  it("asks someone joining a salon for their profile first, then for the code", async () => {
    mockedIntent.mockResolvedValue("staff");
    await expect(resolveNextRoute(session({ profile: null, status: "profile_incomplete" }), true)).resolves.toBe(
      ROUTES.profileSetup,
    );
    await expect(resolveNextRoute(session(), true)).resolves.toBe(ROUTES.joinSalon);
  });

  it("leaves a client without that intent on the map", async () => {
    mockedIntent.mockResolvedValue(null);
    await expect(resolveNextRoute(session(), true)).resolves.toBe(ROUTES.discover);
    mockedIntent.mockResolvedValue("particulier");
    await expect(resolveNextRoute(session(), true)).resolves.toBe(ROUTES.discover);
  });

  it("ignores a stale intent once the account is in a salon", async () => {
    mockedIntent.mockResolvedValue("staff");
    await expect(resolveNextRoute(session({ role: "staff", staffMembership: MEMBERSHIP }), true)).resolves.toBe(
      ROUTES.staffAgenda,
    );
  });
});

describe("routeForInviteLink (the owner's QR code or link, TODO.md Phase 3)", () => {
  it("signs someone new up, then takes a client account to « Rejoindre un salon »", () => {
    expect(routeForInviteLink(null)).toBe(ROUTES.signUp);
    expect(routeForInviteLink(session())).toBe(ROUTES.joinSalon);
    // Names first: the salon's owner sees who joined.
    expect(routeForInviteLink(session({ profile: null, status: "profile_incomplete" }))).toBe(ROUTES.profileSetup);
    expect(routeForInviteLink(session({ emailVerified: false, status: "pending_email" }))).toBe(ROUTES.verifyEmail);
  });

  it("takes a staff account between salons to the code, and one in a salon to its agenda", () => {
    expect(routeForInviteLink(session({ role: "staff", staffMembership: null }))).toBe(ROUTES.joinSalon);
    expect(routeForInviteLink(session({ role: "staff", staffMembership: MEMBERSHIP }))).toBe(ROUTES.staffAgenda);
  });

  it("leaves a salon's owner where he belongs", () => {
    expect(
      routeForInviteLink(session({ role: "coiffeur", status: "active", shopProfileComplete: true, profile: null })),
    ).toBe(ROUTES.proDashboard);
  });
});
