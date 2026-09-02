import { pageWindow } from "./Pagination";

describe("pageWindow", () => {
  it("lists every page when they all fit", () => {
    expect(pageWindow(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("collapses the far side when near the start", () => {
    expect(pageWindow(2, 20)).toEqual([1, 2, 3, 4, "ellipsis", 20]);
  });

  it("collapses the near side when at the end", () => {
    expect(pageWindow(20, 20)).toEqual([1, "ellipsis", 17, 18, 19, 20]);
  });

  it("keeps the current page between its neighbours in the middle", () => {
    expect(pageWindow(10, 20)).toEqual([1, "ellipsis", 9, 10, 11, "ellipsis", 20]);
  });

  it("never renders more slots than the row can fit", () => {
    for (let page = 1; page <= 50; page++) {
      expect(pageWindow(page, 50).length).toBeLessThanOrEqual(7);
    }
  });
});
