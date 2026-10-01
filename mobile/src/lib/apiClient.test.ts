import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";

const mockGetSession = jest.fn();
const mockSignOut = jest.fn().mockResolvedValue({ error: null });
jest.mock("./supabase", () => ({ supabase: { auth: { getSession: mockGetSession, signOut: mockSignOut } } }));

process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { apiClient } = require("./apiClient") as typeof import("./apiClient");

/** Answers every request with `status`, as the server would. */
function serverAnswers(status: number) {
  apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const response = { status, data: {}, statusText: "", headers: {}, config };
    if (status < 400) return response;
    throw new AxiosError("Request failed", undefined, config, undefined, response);
  };
}

describe("apiClient", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockSignOut.mockClear();
  });

  it("sends the signed-in user's token", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "abc" } } });
    serverAnswers(200);
    const response = await apiClient.get("/users/me");
    expect(new AxiosHeaders(response.config.headers).get("Authorization")).toBe("Bearer abc");
  });

  it("drops a session the server no longer accepts (account deleted, token revoked), back to sign-in", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "dead" } } });
    serverAnswers(401);
    await expect(apiClient.get("/salon/me")).rejects.toMatchObject({ response: { status: 401 } });
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("leaves things alone for a request sent while signed out", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    serverAnswers(401);
    await expect(apiClient.get("/salon/me")).rejects.toBeInstanceOf(AxiosError);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("keeps a newer account signed in when a late 401 is about the previous one", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: { access_token: "old" } } });
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "new" } } });
    serverAnswers(401);
    await expect(apiClient.get("/salon/me")).rejects.toBeInstanceOf(AxiosError);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("leaves the session alone on other errors", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "abc" } } });
    serverAnswers(403);
    await expect(apiClient.get("/salon/me")).rejects.toBeInstanceOf(AxiosError);
    serverAnswers(500);
    await expect(apiClient.get("/salon/me")).rejects.toBeInstanceOf(AxiosError);
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
