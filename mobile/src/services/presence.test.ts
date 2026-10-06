import { AxiosError, AxiosHeaders } from "axios";
import { apiClient } from "../lib/apiClient";
import { confirmPresence, normalizePresenceCode, presenceErrorMessage } from "./presence";

jest.mock("../lib/apiClient", () => ({ apiClient: { post: jest.fn() } }));
jest.mock("../lib/supabase", () => ({ supabase: {} }));

const post = apiClient.post as jest.Mock;

function httpError(status: number, message: string): AxiosError {
  const error = new AxiosError("Request failed");
  error.response = { status, data: { message }, statusText: "", headers: {}, config: { headers: new AxiosHeaders() } };
  return error;
}

describe("normalizePresenceCode", () => {
  it("reads a code however it was opened: capitals, no spaces, nothing else", () => {
    expect(normalizePresenceCode(" k7m2-qx9a bcde ")).toBe("K7M2QX9ABCDE");
    expect(normalizePresenceCode("K7M2QX9ABCDE%20")).toBe("K7M2QX9ABCDE");
  });

  it("gives an empty code for what can't be one: not twelve characters", () => {
    expect(normalizePresenceCode("K7M2")).toBe("");
    expect(normalizePresenceCode("K7M2QX9ABCDEF")).toBe("");
    expect(normalizePresenceCode("")).toBe("");
  });
});

describe("confirmPresence", () => {
  it("sends the code and returns what the confirmation screen shows", async () => {
    post.mockResolvedValueOnce({
      data: {
        appointmentId: "a1",
        salonName: "Studio W",
        serviceName: "Coupe",
        startsAt: "2026-10-05T10:00:00Z",
        confirmedAt: "2026-10-05T11:00:00Z",
      },
    });

    await expect(confirmPresence("k7m2qx9abcde")).resolves.toMatchObject({ salonName: "Studio W", serviceName: "Coupe" });
    expect(post).toHaveBeenCalledWith("/presence/confirm", { code: "K7M2QX9ABCDE" });
  });
});

describe("presenceErrorMessage", () => {
  it("says an expired or unknown code must be shown again by the salon", () => {
    expect(presenceErrorMessage(httpError(404, "INVALID_CODE: this code is unknown or has expired"))).toBe(
      "Ce code n'est plus valable. Demandez au salon d'en afficher un nouveau.",
    );
  });

  it("says a code for someone else's appointment needs the account that booked", () => {
    expect(presenceErrorMessage(httpError(403, "NOT_YOUR_APPOINTMENT: this appointment is not yours"))).toBe(
      "Ce code correspond à un rendez-vous d'un autre compte. Connectez-vous avec le compte qui a réservé.",
    );
  });

  it("says a cancelled appointment is no longer on", () => {
    expect(presenceErrorMessage(httpError(409, "NOT_CONFIRMED: this appointment is no longer on"))).toBe(
      "Ce rendez-vous n'est plus en cours.",
    );
  });

  it("covers everything else, a lost connection included, with a retry", () => {
    expect(presenceErrorMessage(httpError(500, "boom"))).toBe("Une erreur est survenue. Vérifiez votre connexion et réessayez.");
    expect(presenceErrorMessage(new Error("Network Error"))).toBe("Une erreur est survenue. Vérifiez votre connexion et réessayez.");
  });
});
