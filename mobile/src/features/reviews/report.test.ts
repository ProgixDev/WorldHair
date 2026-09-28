import { AxiosError, AxiosHeaders } from "axios";
import { reportErrorMessage } from "./report";

jest.mock("../../lib/apiClient", () => ({ apiClient: {} }));

function refused(status: number): AxiosError {
  const headers = new AxiosHeaders();
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers,
    config: { headers },
    data: {},
  });
}

describe("reportErrorMessage", () => {
  it("explains in French why a report wasn't taken", () => {
    expect(reportErrorMessage(refused(409))).toBe("Vous avez déjà signalé cet avis.");
    expect(reportErrorMessage(refused(400))).toBe("Vous ne pouvez pas signaler votre propre avis.");
    expect(reportErrorMessage(new Error("network down"))).toBe("Le signalement n'a pas pu être envoyé. Réessayez.");
  });
});
