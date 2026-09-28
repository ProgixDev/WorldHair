import { AxiosError, AxiosHeaders } from "axios";
import { proErrorMessage } from "./pro";

jest.mock("../lib/apiClient", () => ({ apiClient: {} }));
jest.mock("../lib/supabase", () => ({ supabase: {} }));
jest.mock("../lib/uploadPhoto", () => ({}));

function serverRefusal(message: string): AxiosError {
  const headers = new AxiosHeaders();
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 400,
    statusText: "Bad Request",
    headers,
    config: { headers },
    data: { message },
  });
}

describe("proErrorMessage", () => {
  it("explains in French why the server refused a move or a mark", () => {
    expect(proErrorMessage(serverRefusal("This slot is no longer available"))).toBe(
      "Ce créneau est déjà pris.",
    );
    expect(proErrorMessage(serverRefusal("The client already has an appointment at that time"))).toBe(
      "Le client a déjà un rendez-vous à ce moment-là.",
    );
    expect(proErrorMessage(serverRefusal("The salon is closed at that time"))).toBe(
      "Le salon est fermé à ce moment-là.",
    );
    expect(proErrorMessage(serverRefusal("This appointment hasn't started yet"))).toBe(
      "Ce rendez-vous n'a pas encore commencé.",
    );
    expect(proErrorMessage(serverRefusal("This request has expired"))).toBe(
      "Cette demande a expiré : son horaire est passé.",
    );
    expect(proErrorMessage(serverRefusal("This appointment has already started"))).toBe(
      "Ce rendez-vous a déjà commencé : il ne peut plus être déplacé.",
    );
    expect(proErrorMessage(serverRefusal("The client already left a review for this appointment"))).toBe(
      "Le client a déjà laissé un avis sur ce rendez-vous : il ne peut plus être marqué absent.",
    );
  });

  it("falls back to a generic message for anything else", () => {
    expect(proErrorMessage(new Error("network down"))).toBe("Une erreur est survenue. Réessayez.");
  });
});
