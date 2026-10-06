import { AxiosError, AxiosHeaders } from "axios";
import { apiClient } from "../lib/apiClient";
import {
  completionCodeErrorMessage,
  getPresenceStatus,
  isAlreadyConfirmed,
  issueCompletionCode,
} from "./completionCode";

jest.mock("../lib/apiClient", () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock("../lib/supabase", () => ({ supabase: {} }));
jest.mock("../lib/uploadPhoto", () => ({}));

function httpError(status: number, message?: string): AxiosError {
  const headers = new AxiosHeaders();
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers,
    config: { headers },
    data: message ? { message } : {},
  });
}

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

describe("issueCompletionCode", () => {
  it("asks the server for a fresh code for this booking", async () => {
    post.mockResolvedValueOnce({ data: { code: "ABCDEFGHJKMN", expiresAt: "2026-10-05T19:05:00.000Z" } });
    await expect(issueCompletionCode("a1")).resolves.toEqual({
      code: "ABCDEFGHJKMN",
      expiresAt: "2026-10-05T19:05:00.000Z",
    });
    expect(post).toHaveBeenCalledWith("/presence/a1/code");
  });
});

describe("getPresenceStatus", () => {
  it("says whether the client has confirmed yet", async () => {
    get.mockResolvedValueOnce({ data: { confirmedByClientAt: null } });
    await expect(getPresenceStatus("a1")).resolves.toEqual({ confirmedByClientAt: null });
    expect(get).toHaveBeenCalledWith("/presence/a1/status");

    get.mockResolvedValueOnce({ data: { confirmedByClientAt: "2026-10-05T19:02:00.000Z" } });
    await expect(getPresenceStatus("a1")).resolves.toEqual({ confirmedByClientAt: "2026-10-05T19:02:00.000Z" });
  });
});

describe("completionCodeErrorMessage", () => {
  it("says a booking that hasn't started has no code yet", () => {
    expect(completionCodeErrorMessage(httpError(400, "This appointment hasn't started yet"))).toBe(
      "Le rendez-vous n'a pas encore commencé.",
    );
  });

  it("says a booking too long past can't show one", () => {
    expect(completionCodeErrorMessage(httpError(400, "This appointment is too long past for a code"))).toBe(
      "Ce rendez-vous est trop ancien pour afficher un code.",
    );
  });

  it("says an absent booking has none", () => {
    expect(completionCodeErrorMessage(httpError(400, "This appointment is marked absent"))).toBe(
      "Ce rendez-vous est marqué absent.",
    );
  });

  it("says a booking not accepted has none", () => {
    expect(completionCodeErrorMessage(httpError(400, "Only an accepted appointment has an end-of-service code"))).toBe(
      "Seul un rendez-vous accepté a un code de fin.",
    );
  });

  it("says the client already confirmed", () => {
    expect(
      completionCodeErrorMessage(httpError(409, "ALREADY_CONFIRMED: the client already confirmed this appointment")),
    ).toBe("Le client a déjà confirmé ce rendez-vous.");
  });

  it("says a booking that isn't theirs isn't theirs to confirm", () => {
    expect(completionCodeErrorMessage(httpError(403))).toBe("Ce rendez-vous ne vous est pas attribué.");
  });

  it("says when there's no network, and falls back to the generic message otherwise", () => {
    const offline = new AxiosError("Network Error", "ERR_NETWORK");
    expect(completionCodeErrorMessage(offline)).toBe("Connexion impossible. Vérifiez votre réseau et réessayez.");
    expect(completionCodeErrorMessage(httpError(500, "boom"))).toBe("Une erreur est survenue. Réessayez.");
    expect(completionCodeErrorMessage(new Error("anything"))).toBe("Une erreur est survenue. Réessayez.");
  });
});

describe("isAlreadyConfirmed", () => {
  it("recognises the server's ALREADY_CONFIRMED refusal, and nothing else", () => {
    expect(isAlreadyConfirmed(httpError(409, "ALREADY_CONFIRMED: the client already confirmed"))).toBe(true);
    expect(isAlreadyConfirmed(httpError(409, "TEAM_FULL: no place left"))).toBe(false);
    expect(isAlreadyConfirmed(new Error("x"))).toBe(false);
  });
});
