import { supabase } from "../lib/supabase";
import { AuthError, signUpWithEmail } from "./auth";

jest.mock("../lib/supabase", () => ({
  supabase: { auth: { signUp: jest.fn() } },
}));
jest.mock("../lib/apiClient", () => ({ apiClient: {} }));
jest.mock("../lib/uploadPhoto", () => ({}));
jest.mock("./pro", () => ({}));

const mockedSignUp = supabase.auth.signUp as jest.Mock;

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
