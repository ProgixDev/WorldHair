import { AxiosError, AxiosHeaders } from "axios";
import { apiClient } from "../lib/apiClient";
import { accountErrorMessage, accountStillExists, termsUpToDate } from "./account";

jest.mock("../lib/apiClient", () => ({ apiClient: { get: jest.fn() } }));

function httpError(status: number, message?: string): AxiosError {
  const error = new AxiosError("Request failed");
  error.response = {
    status,
    data: message ? { message } : {},
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  return error;
}

const get = apiClient.get as jest.Mock;

describe("accountErrorMessage", () => {
  it("tells a salon owed money to set up its payouts first", () => {
    expect(accountErrorMessage(httpError(409))).toContain("vos encaissements ne sont pas actifs");
  });

  it("tells a staff member the salon has to reassign their bookings to come first", () => {
    const message = accountErrorMessage(
      httpError(409, "STAFF_HAS_BOOKINGS: the salon has to reassign your bookings to come first"),
    );
    expect(message).toBe(
      "Des rendez-vous à venir sont encore à votre nom : demandez au salon de les réattribuer à quelqu'un d'autre, puis réessayez.",
    );
  });

  it("says a deletion that stopped half-way can be tried again, without pretending nothing happened", () => {
    expect(accountErrorMessage(httpError(503))).toBe(
      "La suppression n'a pas pu aller jusqu'au bout. Réessayez dans quelques minutes : ce qui a déjà été fait (annulations, remboursements) ne sera pas refait.",
    );
  });

  it("covers everything else with a generic retry", () => {
    expect(accountErrorMessage(httpError(500))).toBe("Une erreur est survenue. Vérifiez votre connexion et réessayez.");
    expect(accountErrorMessage(new Error("Network Error"))).toBe("Une erreur est survenue. Vérifiez votre connexion et réessayez.");
  });
});

describe("termsUpToDate", () => {
  it("takes the server's word, whatever version this build knows", async () => {
    get.mockResolvedValueOnce({ data: { termsUpToDate: false } });
    await expect(termsUpToDate()).resolves.toBe(false);
    get.mockResolvedValueOnce({ data: { termsUpToDate: true } });
    await expect(termsUpToDate()).resolves.toBe(true);
  });

  it("doesn't hold the user up without a clear answer", async () => {
    get.mockRejectedValueOnce(new Error("Network Error"));
    await expect(termsUpToDate()).resolves.toBe(true);
  });
});

describe("accountStillExists", () => {
  it("is gone once the server no longer knows the session's account", async () => {
    get.mockRejectedValueOnce(httpError(401));
    await expect(accountStillExists()).resolves.toBe(false);
    get.mockResolvedValueOnce({ data: {} });
    await expect(accountStillExists()).resolves.toBe(true);
    get.mockRejectedValueOnce(new Error("Network Error"));
    await expect(accountStillExists()).resolves.toBe(true);
  });
});
