import { supabase } from "../lib/supabase";
import { AuthError, getSession, resendVerificationCode, signUpWithEmail } from "./auth";
import { getMyMembership } from "./staff";

jest.mock("../lib/supabase", () => ({
  supabase: { auth: { signUp: jest.fn(), resend: jest.fn(), getSession: jest.fn() }, from: jest.fn() },
}));
jest.mock("../lib/apiClient", () => ({ apiClient: {} }));
jest.mock("../lib/uploadPhoto", () => ({}));
jest.mock("./pro", () => ({}));
jest.mock("./staff", () => ({ getMyMembership: jest.fn() }));

const mockedSignUp = supabase.auth.signUp as jest.Mock;
const mockedResend = supabase.auth.resend as jest.Mock;
const mockedGetSession = supabase.auth.getSession as jest.Mock;
const mockedFrom = supabase.from as jest.Mock;
const mockedMembership = getMyMembership as jest.Mock;

/** A signed-in, verified user whose `profiles` row is `row`. */
function signedInWithProfile(row: Record<string, unknown>) {
  mockedGetSession.mockResolvedValue({
    data: {
      session: { user: { id: "u1", email: "lea@example.com", email_confirmed_at: "2026-10-01", created_at: "2026-10-01" } },
    },
  });
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: row, error: null }) };
  mockedFrom.mockReturnValue(query);
}

const PROFILE_ROW = { first_name: "Léa", last_name: "Martin", photo_url: null, created_at: "2026-10-01" };

describe("getSession", () => {
  beforeEach(() => mockedMembership.mockReset());

  it("reads a staff member like a client, plus the salon they work in", async () => {
    signedInWithProfile({ ...PROFILE_ROW, role: "staff" });
    mockedMembership.mockResolvedValue({ staffId: "s1", salonId: "salon1", salonName: "Maison Tresse" });

    await expect(getSession()).resolves.toMatchObject({
      role: "staff",
      status: "active",
      profile: { firstName: "Léa", lastName: "Martin" },
      staffMembership: { staffId: "s1", salonId: "salon1", salonName: "Maison Tresse" },
    });
  });

  it("says a staff member out of a salon has none", async () => {
    signedInWithProfile({ ...PROFILE_ROW, role: "staff" });
    mockedMembership.mockResolvedValue(null);

    await expect(getSession()).resolves.toMatchObject({ role: "staff", staffMembership: null });
  });

  // An unreachable server must not pass for « not in a salon »: that would send them to join one.
  it("leaves the salon unknown when the server can't be asked", async () => {
    signedInWithProfile({ ...PROFILE_ROW, role: "staff" });
    mockedMembership.mockRejectedValue(new Error("Network Error"));

    const session = await getSession();
    expect(session?.role).toBe("staff");
    expect(session?.staffMembership).toBeUndefined();
  });

  it("never asks the server for a client's salon", async () => {
    signedInWithProfile({ ...PROFILE_ROW, role: "particulier" });

    const session = await getSession();
    expect(session?.role).toBe("particulier");
    expect(session).not.toHaveProperty("staffMembership");
    expect(mockedMembership).not.toHaveBeenCalled();
  });
});

describe("signUpWithEmail", () => {
  beforeEach(() => mockedSignUp.mockReset());

  it("resolves for a brand-new email", async () => {
    mockedSignUp.mockResolvedValue({
      data: { user: { id: "u1", identities: [{ id: "i1" }] }, session: null },
      error: null,
    });

    await expect(
      signUpWithEmail({ email: "new@example.com", password: "secret123", role: "particulier" }),
    ).resolves.toBeUndefined();
  });

  // With "Confirm email" on, Supabase answers an already-registered address
  // with no error at all — just an obfuscated user whose `identities` is
  // empty, and no email sent. Without this check the app routes to the code
  // screen and waits for a mail that never comes.
  it("rejects with EMAIL_IN_USE when Supabase returns an obfuscated existing user", async () => {
    mockedSignUp.mockResolvedValue({
      data: { user: { id: "fake", identities: [] }, session: null },
      error: null,
    });

    await expect(
      signUpWithEmail({ email: "taken@example.com", password: "secret123", role: "particulier" }),
    ).rejects.toMatchObject({ code: "EMAIL_IN_USE" } satisfies Partial<AuthError>);
  });
});

describe("resendVerificationCode", () => {
  beforeEach(() => mockedResend.mockReset());

  it("resolves when Supabase accepts the resend", async () => {
    mockedResend.mockResolvedValue({ data: {}, error: null });

    await expect(resendVerificationCode("a@example.com")).resolves.toBeUndefined();
  });

  // Per-user window: Supabase refuses a second signup email to the same
  // address within 60s and says how long is left.
  it("rejects with RATE_LIMITED and the wait time on the per-user window", async () => {
    mockedResend.mockResolvedValue({
      data: {},
      error: {
        status: 429,
        code: "over_email_send_rate_limit",
        message: "For security purposes, you can only request this after 42 seconds.",
      },
    });

    await expect(resendVerificationCode("a@example.com")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: "Patientez 42 s avant de renvoyer un code.",
    } satisfies Partial<AuthError>);
  });

  // Project-wide hourly cap: no wait time given.
  it("rejects with RATE_LIMITED on the project-wide hourly email cap", async () => {
    mockedResend.mockResolvedValue({
      data: {},
      error: { status: 429, code: "over_email_send_rate_limit", message: "email rate limit exceeded" },
    });

    await expect(resendVerificationCode("a@example.com")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: "Trop d'envois récents. Réessayez dans quelques minutes.",
    } satisfies Partial<AuthError>);
  });
});
