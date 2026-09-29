import { legalPageUrl } from "./terms";

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
