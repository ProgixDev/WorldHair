import { AxiosError, AxiosHeaders } from "axios";
import { apiClient } from "../lib/apiClient";
import { getMyMembership, joinSalon, normalizeInviteCode, staffErrorMessage } from "./staff";

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

describe("normalizeInviteCode", () => {
  it("keeps six letters or digits, in capitals, however they were typed", () => {
    expect(normalizeInviteCode(" ab3 d-ef ")).toBe("AB3DEF");
    expect(normalizeInviteCode("abcdefgh")).toBe("ABCDEF");
  });
});

describe("joinSalon", () => {
  it("sends the code as typed, cleaned, and hands back the salon joined", async () => {
    post.mockResolvedValueOnce({
      data: { staffId: "s1", salonId: "salon1", salonName: "Maison Tresse", isOwner: false },
    });
    await expect(joinSalon("ab3def")).resolves.toEqual({
      staffId: "s1",
      salonId: "salon1",
      salonName: "Maison Tresse",
    });
    expect(post).toHaveBeenCalledWith("/staff/join", { code: "AB3DEF" });
  });
});

describe("getMyMembership", () => {
  it("reads where this account works — null once out of a salon", async () => {
    get.mockResolvedValueOnce({
      data: { membership: { staffId: "s1", salonId: "salon1", salonName: "Maison Tresse", isOwner: false } },
    });
    await expect(getMyMembership()).resolves.toEqual({ staffId: "s1", salonId: "salon1", salonName: "Maison Tresse" });
    get.mockResolvedValueOnce({ data: { membership: null } });
    await expect(getMyMembership()).resolves.toBeNull();
  });
});

describe("staffErrorMessage", () => {
  it("says a code that can't be used must be asked for again", () => {
    expect(staffErrorMessage(httpError(404, "INVALID_CODE: this code is unknown, used or expired"))).toBe(
      "Ce code n'existe pas, a déjà servi ou a expiré. Demandez-en un nouveau au salon.",
    );
  });

  it("says an account already in a salon has to leave it first", () => {
    expect(staffErrorMessage(httpError(409, "ALREADY_IN_SALON: leave your current salon first"))).toBe(
      "Votre compte fait déjà partie d'un salon : quittez-le d'abord pour en rejoindre un autre.",
    );
  });

  it("says a salon whose team is full must move to the Équipe formula, and that the code isn't spent", () => {
    expect(staffErrorMessage(httpError(409, "TEAM_FULL: your salon's formula has no place left"))).toBe(
      "Ce salon a atteint la taille de son équipe. Demandez au gérant de passer à la formule Équipe, puis réessayez avec le même code.",
    );
  });

  it("says leaving waits until the salon has reassigned the bookings to come", () => {
    expect(
      staffErrorMessage(httpError(409, "STAFF_HAS_BOOKINGS: the salon has to reassign your bookings to come first")),
    ).toBe(
      "Des rendez-vous à venir sont encore à votre nom : demandez au salon de les réattribuer à quelqu'un d'autre, puis réessayez.",
    );
  });

  it("says a malformed code is six characters", () => {
    expect(staffErrorMessage(httpError(400, "code must be longer than or equal to 6 characters"))).toBe(
      "Le code fait 6 caractères, lettres et chiffres.",
    );
  });

  it("explains a refused honoré/absent the same way the salon reads it", () => {
    expect(staffErrorMessage(httpError(400, "This appointment hasn't started yet"))).toBe(
      "Ce rendez-vous n'a pas encore commencé.",
    );
    expect(staffErrorMessage(httpError(400, "The client already left a review for this appointment"))).toBe(
      "Le client a déjà laissé un avis sur ce rendez-vous : il ne peut plus être marqué absent.",
    );
  });

  it("says an account no longer in a salon is out of it", () => {
    expect(staffErrorMessage(httpError(404, "Not in a salon"))).toBe("Vous ne faites plus partie de ce salon.");
  });

  it("blames the connection when the server never answered, and retries otherwise", () => {
    expect(staffErrorMessage(new AxiosError("Network Error", "ERR_NETWORK"))).toBe(
      "Connexion impossible. Vérifiez votre réseau et réessayez.",
    );
    expect(staffErrorMessage(httpError(500))).toBe("Une erreur est survenue. Réessayez.");
  });
});
