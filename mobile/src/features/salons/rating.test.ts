import { ratingLabel } from "./rating";

describe("ratingLabel", () => {
  it("has no rating to show before the first review", () => {
    expect(ratingLabel({ rating: 0, reviewCount: 0 })).toBeNull();
  });

  it("writes the average with a French decimal comma", () => {
    expect(ratingLabel({ rating: 4.8, reviewCount: 12 })).toBe("4,8");
    expect(ratingLabel({ rating: 5, reviewCount: 1 })).toBe("5,0");
  });
});
