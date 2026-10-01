import { renderHook } from "@testing-library/react-native";

import { ROUTES } from "./routing";
import { useSignedOutRedirect } from "./useSignedOutRedirect";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock("../../lib/supabase", () => ({ supabase: {} }));
jest.mock("../../lib/apiClient", () => ({ apiClient: {} }));

describe("useSignedOutRedirect", () => {
  beforeEach(() => mockReplace.mockClear());

  it("goes back to sign-in when the session ends under the user (refused by the server)", async () => {
    const { rerender } = await renderHook(({ signedIn }: { signedIn: boolean }) => useSignedOutRedirect(signedIn), {
      initialProps: { signedIn: true },
    });
    expect(mockReplace).not.toHaveBeenCalled();

    await rerender({ signedIn: false });
    expect(mockReplace).toHaveBeenCalledWith(ROUTES.signIn);
  });

  it("does nothing for someone who was never signed in", async () => {
    const { rerender } = await renderHook(({ signedIn }: { signedIn: boolean }) => useSignedOutRedirect(signedIn), {
      initialProps: { signedIn: false },
    });
    await rerender({ signedIn: false });
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
