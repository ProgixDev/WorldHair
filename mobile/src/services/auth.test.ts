import { supabase } from "../lib/supabase";
import { AuthError, resendVerificationCode, signUpWithEmail } from "./auth";

jest.mock("../lib/supabase", () => ({
  supabase: { auth: { signUp: jest.fn(), resend: jest.fn() } },
}));
jest.mock("../lib/apiClient", () => ({ apiClient: {} }));
jest.mock("../lib/uploadPhoto", () => ({}));
jest.mock("./pro", () => ({}));

const mockedSignUp = supabase.auth.signUp as jest.Mock;
const mockedResend = supabase.auth.resend as jest.Mock;

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
