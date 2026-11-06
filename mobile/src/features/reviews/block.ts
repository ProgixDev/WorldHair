import { isAxiosError } from "axios";
import { apiClient } from "../../lib/apiClient";

/** Someone this person blocked — server/src/reviews/reviews.service.ts's BlockedUserDto. */
export interface BlockedUser {
  userId: string;
  /** As their reviews sign: « Camille D. ». */
  name: string;
  blockedAt: string;
}

/** A French message for a block the server didn't take, from its own reason. */
export function blockErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const body = err.response?.data as { message?: unknown } | undefined;
    const message = typeof body?.message === "string" ? body.message : "";
    if (message.includes("block yourself")) return "Vous ne pouvez pas vous bloquer vous-même.";
    if (message.includes("its own salon")) return "Un salon ne peut bloquer que les auteurs des avis sur son propre salon.";
    if (message.includes("no longer has an account")) return "L'auteur de cet avis n'a plus de compte.";
  }
  return "Le blocage n'a pas pu être enregistré. Réessayez.";
}

/**
 * « Bloquer cet utilisateur » (App Store guideline 1.2): the author of this
 * review, for this person only — none of their reviews shows to them any
 * more. Blocking someone already blocked is fine.
 */
export async function blockReviewAuthor(reviewId: string): Promise<void> {
  try {
    await apiClient.post(`/reviews/${reviewId}/block`);
  } catch (err) {
    throw new Error(blockErrorMessage(err));
  }
}

/** « Utilisateurs bloqués », the latest first. */
export async function listBlockedUsers(): Promise<BlockedUser[]> {
  const { data } = await apiClient.get<BlockedUser[]>("/reviews/blocked");
  return data;
}

/** Their reviews show again. */
export async function unblockUser(userId: string): Promise<void> {
  await apiClient.delete(`/reviews/blocked/${userId}`);
}
