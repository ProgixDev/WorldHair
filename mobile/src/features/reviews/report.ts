import { isAxiosError } from "axios";
import { apiClient } from "../../lib/apiClient";

/** Why a review is reported — server/src/reviews/reviews.service.ts's REPORT_REASONS. */
export type ReportReason = "offensive" | "fake" | "personal_info" | "spam" | "other";

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "offensive", label: "Propos injurieux ou haineux" },
  { value: "fake", label: "Faux avis" },
  { value: "personal_info", label: "Informations personnelles" },
  { value: "spam", label: "Publicité ou spam" },
  { value: "other", label: "Autre raison" },
];

/** A French message for a report the server didn't take, from its own reason. */
export function reportErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const body = err.response?.data as { message?: unknown } | undefined;
    const message = typeof body?.message === "string" ? body.message : "";
    if (message.includes("your own review")) return "Vous ne pouvez pas signaler votre propre avis.";
    if (message.includes("its own salon")) return "Un salon ne peut signaler que les avis sur son propre salon.";
  }
  return "Le signalement n'a pas pu être envoyé. Réessayez.";
}

/**
 * "Signaler" (TODO.md Phase 6): once per person and review. The review goes
 * to the admins' queue and stays visible until they decide. `already`: this
 * person had reported it before — it's reported all the same.
 */
export async function reportReview(
  reviewId: string,
  reason: ReportReason,
  details?: string,
): Promise<"reported" | "already"> {
  const trimmed = details?.trim();
  try {
    await apiClient.post(`/reviews/${reviewId}/report`, { reason, ...(trimmed ? { details: trimmed } : {}) });
    return "reported";
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 409) return "already";
    throw new Error(reportErrorMessage(err));
  }
}
