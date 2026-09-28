import { legalPageUrl, mustAcceptTerms, TERMS_VERSION } from "./terms";

describe("legalPageUrl", () => {
  it("builds the site's page from its address, whatever the trailing slash", () => {
    expect(legalPageUrl("cgu", "https://worldhair.onrender.com")).toBe("https://worldhair.onrender.com/cgu");
    expect(legalPageUrl("confidentialite", "https://worldhair.onrender.com/ ")).toBe(
      "https://worldhair.onrender.com/confidentialite",
    );
  });

  it("has nothing to open when the site's address isn't set", () => {
    expect(legalPageUrl("mentions-legales", "")).toBeNull();
    expect(legalPageUrl("mentions-legales", undefined)).toBeNull();
  });
});

describe("mustAcceptTerms", () => {
  it("asks a signed-in user who accepted an older version, or none, to accept the current one", () => {
    expect(mustAcceptTerms({ termsVersion: TERMS_VERSION })).toBe(false);
    expect(mustAcceptTerms({ termsVersion: "2025-01-01" })).toBe(true);
    expect(mustAcceptTerms({ termsVersion: null })).toBe(true);
    expect(mustAcceptTerms(null)).toBe(false);
  });
});
