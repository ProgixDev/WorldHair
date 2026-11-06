import { AxiosError, AxiosHeaders } from "axios";
import { apiClient } from "../../lib/apiClient";
import { blockErrorMessage, blockReviewAuthor, listBlockedUsers, unblockUser } from "./block";

jest.mock("../../lib/apiClient", () => ({ apiClient: { post: jest.fn(), get: jest.fn(), delete: jest.fn() } }));

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

describe("blockErrorMessage", () => {
  it("explains in French why a block wasn't taken", () => {
    expect(blockErrorMessage(refused(400, "You can't block yourself"))).toBe("Vous ne pouvez pas vous bloquer vous-même.");
    expect(blockErrorMessage(refused(403, "A salon can only block the authors of its own salon's reviews"))).toBe(
      "Un salon ne peut bloquer que les auteurs des avis sur son propre salon.",
    );
    expect(blockErrorMessage(refused(400, "This author no longer has an account"))).toBe("L'auteur de cet avis n'a plus de compte.");
    expect(blockErrorMessage(new Error("network down"))).toBe("Le blocage n'a pas pu être enregistré. Réessayez.");
  });
});

describe("blocking", () => {
  it("blocks a review's author, lists who is blocked, and unblocks", async () => {
    jest.mocked(apiClient.post).mockResolvedValueOnce({ data: undefined });
    jest.mocked(apiClient.get).mockResolvedValueOnce({
      data: [{ userId: "user-1", name: "Camille D.", blockedAt: "2026-11-06T10:00:00.000Z" }],
    });
    jest.mocked(apiClient.delete).mockResolvedValueOnce({ data: undefined });

    await blockReviewAuthor("review-1");
    expect(apiClient.post).toHaveBeenLastCalledWith("/reviews/review-1/block");
    await expect(listBlockedUsers()).resolves.toEqual([{ userId: "user-1", name: "Camille D.", blockedAt: "2026-11-06T10:00:00.000Z" }]);
    await unblockUser("user-1");
    expect(apiClient.delete).toHaveBeenLastCalledWith("/reviews/blocked/user-1");
  });

  it("turns a refusal into its French message", async () => {
    jest.mocked(apiClient.post).mockRejectedValueOnce(refused(400, "You can't block yourself"));

    await expect(blockReviewAuthor("review-1")).rejects.toThrow("Vous ne pouvez pas vous bloquer vous-même.");
  });
});
