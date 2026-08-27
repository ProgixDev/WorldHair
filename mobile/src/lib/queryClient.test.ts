import { shouldRetry } from "./queryClient";

const errorWithStatus = (status: number) => ({ response: { status } });

describe("shouldRetry", () => {
  it("does not retry a 4xx client error", () => {
    expect(shouldRetry(0, errorWithStatus(400))).toBe(false);
    expect(shouldRetry(0, errorWithStatus(401))).toBe(false);
    expect(shouldRetry(0, errorWithStatus(404))).toBe(false);
  });

  it("retries a 5xx server error, up to 2 times", () => {
    expect(shouldRetry(0, errorWithStatus(500))).toBe(true);
    expect(shouldRetry(1, errorWithStatus(500))).toBe(true);
    expect(shouldRetry(2, errorWithStatus(500))).toBe(false);
  });

  it("retries a plain network error (no response/status at all)", () => {
    expect(shouldRetry(0, new Error("Network Error"))).toBe(true);
  });
});
