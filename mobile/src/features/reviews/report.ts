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

/** A French message for a report the server didn't take. */
export function reportErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    if (err.response?.status === 409) return "Vous avez déjà signalé cet avis.";
    if (err.response?.status === 400) return "Vous ne pouvez pas signaler votre propre avis.";
  }
  return "Le signalement n'a pas pu être envoyé. Réessayez.";
}

/**
 * "Signaler" (TODO.md Phase 6): once per person and review. The review goes
 * to the admins' queue and stays visible until they decide.
 */
export async function reportReview(reviewId: string, reason: ReportReason, details?: string): Promise<void> {
  const trimmed = details?.trim();
  try {
    await apiClient.post(`/reviews/${reviewId}/report`, { reason, ...(trimmed ? { details: trimmed } : {}) });
  } catch (err) {
    throw new Error(reportErrorMessage(err));
  }
}
