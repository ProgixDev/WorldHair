import { AxiosError, AxiosHeaders } from "axios";
import { inviteBlockedMessage, inviteRefusal, teamPlaces, teamUsageLabel, tierLabel } from "./tiers";

function refused(status: number, message: string): AxiosError {
  const headers = new AxiosHeaders();
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers,
    config: { headers },
    data: { message },
  });
}

describe("tierLabel", () => {
  it("names the two formulas the way the website sells them", () => {
    expect(tierLabel("solo")).toBe("Solo");
    expect(tierLabel("team")).toBe("Équipe");
  });
});

describe("teamPlaces", () => {
  it("counts what's left once the team and the codes still open took their places", () => {
    expect(teamPlaces({ limit: 5, members: 2, openInvites: 1 })).toEqual({ free: 2, over: false });
    expect(teamPlaces({ limit: 5, members: 1, openInvites: 0 })).toEqual({ free: 4, over: false });
  });

  it("has no place left in a full team or a Solo salon", () => {
    expect(teamPlaces({ limit: 5, members: 5, openInvites: 0 })).toEqual({ free: 0, over: false });
    expect(teamPlaces({ limit: 1, members: 1, openInvites: 0 })).toEqual({ free: 0, over: false });
    expect(teamPlaces({ limit: 5, members: 3, openInvites: 2 })).toEqual({ free: 0, over: false });
  });

  it("never goes negative, and says when the team is bigger than the formula", () => {
    expect(teamPlaces({ limit: 1, members: 3, openInvites: 0 })).toEqual({ free: 0, over: true });
    expect(teamPlaces({ limit: 5, members: 4, openInvites: 3 })).toEqual({ free: 0, over: false });
  });
});

describe("teamUsageLabel", () => {
  it("reads people against the formula's size", () => {
    expect(teamUsageLabel({ limit: 5, members: 2, openInvites: 0 })).toBe("2 personnes sur 5");
    expect(teamUsageLabel({ limit: 5, members: 1, openInvites: 0 })).toBe("1 personne sur 5");
  });

  it("says « Vous seul » for a salon of one on the Solo formula", () => {
    expect(teamUsageLabel({ limit: 1, members: 1, openInvites: 0 })).toBe("Vous seul");
  });

  it("adds the codes still open", () => {
    expect(teamUsageLabel({ limit: 5, members: 2, openInvites: 1 })).toBe("2 personnes sur 5 · 1 code en cours");
    expect(teamUsageLabel({ limit: 5, members: 2, openInvites: 2 })).toBe("2 personnes sur 5 · 2 codes en cours");
  });

  it("doesn't write « 3 sur 1 » for a team bigger than its formula", () => {
    expect(teamUsageLabel({ limit: 1, members: 3, openInvites: 0 })).toBe("3 personnes");
  });
});

describe("inviteBlockedMessage", () => {
  it("lets the owner invite while a place is free", () => {
    expect(inviteBlockedMessage({ tier: "team", limit: 5, members: 2, openInvites: 1 })).toBeNull();
  });

  it("tells a Solo salon to move to Équipe, without a link to do it", () => {
    expect(inviteBlockedMessage({ tier: "solo", limit: 1, members: 1, openInvites: 0 })).toBe(
      "Votre formule Solo est pour une seule personne. Inviter vos collaborateurs demande la formule Équipe.",
    );
  });

  it("says a full Équipe team is complete", () => {
    expect(inviteBlockedMessage({ tier: "team", limit: 5, members: 5, openInvites: 0 })).toBe(
      "Votre équipe est au complet (5 personnes).",
    );
  });

  it("says the open codes hold the places left, and which way out there is", () => {
    expect(inviteBlockedMessage({ tier: "team", limit: 5, members: 3, openInvites: 2 })).toBe(
      "Les places restantes sont réservées par des codes en cours. Annulez-en un pour inviter quelqu'un d'autre.",
    );
  });

  it("says a salon that dropped to Solo keeps its people but can't add anyone", () => {
    expect(inviteBlockedMessage({ tier: "solo", limit: 1, members: 3, openInvites: 0 })).toBe(
      "Votre formule ne couvre plus toute l'équipe : personne ne peut être ajouté.",
    );
  });
});

describe("inviteRefusal", () => {
  const full = "TEAM_FULL: your salon's formula has no place left";

  it("sends a Solo owner to the Équipe formula on the website, in words only", () => {
    expect(inviteRefusal(refused(409, full), "solo")).toBe(
      "Votre formule Solo est pour une seule personne. Inviter vos collaborateurs demande la formule Équipe : changez de formule, puis réessayez.",
    );
  });

  it("asks an Équipe owner with no place left to make room", () => {
    expect(inviteRefusal(refused(409, full), "team")).toBe(
      "Votre équipe est au complet. Retirez quelqu'un ou annulez un code en cours pour faire de la place.",
    );
  });

  it("leaves every other failure to the generic message", () => {
    expect(inviteRefusal(refused(409, "STAFF_HAS_BOOKINGS"), "team")).toBeNull();
    expect(inviteRefusal(refused(500, full), "team")).toBeNull();
    expect(inviteRefusal(new Error("boom"), "team")).toBeNull();
  });
});
