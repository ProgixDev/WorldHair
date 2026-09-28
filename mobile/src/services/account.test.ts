import { AxiosError, AxiosHeaders } from "axios";
import { accountErrorMessage } from "./account";

jest.mock("../lib/apiClient", () => ({ apiClient: {} }));

function httpError(status: number): AxiosError {
  const error = new AxiosError("Request failed");
  error.response = { status, data: {}, statusText: "", headers: {}, config: { headers: new AxiosHeaders() } };
  return error;
}

describe("accountErrorMessage", () => {
  it("says to try again later when the server couldn't finish (Stripe, storage)", () => {
    expect(accountErrorMessage(httpError(503))).toBe(
      "Votre compte n'a pas pu être supprimé pour l'instant : rien n'a été effacé. Réessayez dans quelques minutes.",
    );
  });

  it("covers everything else with a generic retry", () => {
    expect(accountErrorMessage(httpError(500))).toBe("Une erreur est survenue. Vérifiez votre connexion et réessayez.");
    expect(accountErrorMessage(new Error("Network Error"))).toBe("Une erreur est survenue. Vérifiez votre connexion et réessayez.");
  });
});
