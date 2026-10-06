import { normalizePresenceCode, presenceAppUrl } from "./presence";

describe("end-of-service code links (« code de fin »)", () => {
  it("reads a code however it was typed or copied", () => {
    expect(normalizePresenceCode("k7m2qx9d4h8w")).toBe("K7M2QX9D4H8W");
    expect(normalizePresenceCode(" K7M2 QX9D 4H8W ")).toBe("K7M2QX9D4H8W");
    expect(normalizePresenceCode("K7M2QX9D4H8W%20")).toBe("K7M2QX9D4H8W");
  });

  it("refuses what can't be a code", () => {
    expect(normalizePresenceCode("")).toBeNull();
    expect(normalizePresenceCode("K7M2QX")).toBeNull();
    expect(normalizePresenceCode("K7M2QX9D4H8W1")).toBeNull();
    expect(normalizePresenceCode("K7M2-X9D4H8W")).toBeNull();
    // A broken escape is no code either, rather than an error.
    expect(normalizePresenceCode("K7M2QX9D4H%")).toBeNull();
  });

  it("opens the app's confirmation with the code in", () => {
    expect(presenceAppUrl("K7M2QX9D4H8W")).toBe("worldhair://rdv/K7M2QX9D4H8W");
  });
});
