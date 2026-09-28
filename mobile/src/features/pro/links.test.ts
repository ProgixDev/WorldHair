import { socialLink } from "./links";

describe("socialLink", () => {
  it("turns an @handle into the network's page", () => {
    expect(socialLink("instagram", "@studio.w")).toBe("https://instagram.com/studio.w");
    expect(socialLink("tiktok", "studiow")).toBe("https://www.tiktok.com/@studiow");
    expect(socialLink("facebook", "@studiow")).toBe("https://facebook.com/studiow");
  });

  it("keeps a full link, adding https:// when it was left out", () => {
    expect(socialLink("instagram", " https://www.instagram.com/studio.w ")).toBe("https://www.instagram.com/studio.w");
    expect(socialLink("facebook", "facebook.com/studiow")).toBe("https://facebook.com/studiow");
    expect(socialLink("website", "studio-w.fr")).toBe("https://studio-w.fr");
  });

  it('leaves an empty field empty: no link', () => {
    expect(socialLink("website", "   ")).toBe("");
  });
});
