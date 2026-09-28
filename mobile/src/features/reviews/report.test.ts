import { AxiosError, AxiosHeaders } from "axios";
import { apiClient } from "../../lib/apiClient";
import { reportErrorMessage, reportReview } from "./report";

jest.mock("../../lib/apiClient", () => ({ apiClient: { post: jest.fn() } }));

function refused(status: number, message = ""): AxiosError {
  const headers = new AxiosHeaders();
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers,
    config: { headers },
    data: { message },
  });
}

describe("reportErrorMessage", () => {
  it("explains in French why a report wasn't taken", () => {
    expect(reportErrorMessage(refused(400, "You can't report your own review"))).toBe(
      "Vous ne pouvez pas signaler votre propre avis.",
    );
    expect(reportErrorMessage(refused(403, "A salon can only report its own salon's reviews"))).toBe(
      "Un salon ne peut signaler que les avis sur son propre salon.",
    );
    expect(reportErrorMessage(refused(400, ["reason must be one of the following values"] as unknown as string))).toBe(
      "Le signalement n'a pas pu être envoyé. Réessayez.",
    );
    expect(reportErrorMessage(new Error("network down"))).toBe("Le signalement n'a pas pu être envoyé. Réessayez.");
  });
});

describe("reportReview", () => {
  it("takes a review reported before as reported, not as a failure", async () => {
    jest.mocked(apiClient.post).mockRejectedValueOnce(refused(409, "You already reported this review"));

    await expect(reportReview("review-1", "spam")).resolves.toBe("already");
  });

  it("sends the reason and the words typed", async () => {
    jest.mocked(apiClient.post).mockResolvedValueOnce({ data: undefined });

    await expect(reportReview("review-1", "fake", "  jamais venue ")).resolves.toBe("reported");
    expect(apiClient.post).toHaveBeenLastCalledWith("/reviews/review-1/report", { reason: "fake", details: "jamais venue" });
  });
});
