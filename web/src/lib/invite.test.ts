import { inviteAppUrl, normalizeInviteCode } from "./invite";

describe("invite links (TODO.md Phase 3)", () => {
  it("reads a code however it was typed or copied", () => {
    expect(normalizeInviteCode(" k7m2qx ")).toBe("K7M2QX");
    expect(normalizeInviteCode("K7M2QX%20")).toBe("K7M2QX");
  });

  it("refuses what can't be a code", () => {
    expect(normalizeInviteCode("K7M2")).toBeNull();
    expect(normalizeInviteCode("K7M2QX1")).toBeNull();
    expect(normalizeInviteCode("K7M-QX")).toBeNull();
  });

  it("opens the app's « Rejoindre un salon » with the code in", () => {
    expect(inviteAppUrl("K7M2QX")).toBe("worldhair://rejoindre/K7M2QX");
  });
});
