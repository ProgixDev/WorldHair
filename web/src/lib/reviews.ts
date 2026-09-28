import type { ReportReason, ReviewReport } from "@/services/adminApi";

/** The same words as the app's picker (mobile/src/features/reviews/report.ts). */
const REASON_LABELS: Record<ReportReason, string> = {
  offensive: "Propos injurieux ou haineux",
  fake: "Faux avis",
  personal_info: "Informations personnelles",
  spam: "Publicité ou spam",
  other: "Autre raison",
};

/**
 * A report's reason in French. Also reads the one a review keeps
 * (`reportReason`): its code, then the reporter's words after a colon — or,
 * on reviews reported before codes, the words alone.
 */
export function reportReasonLabel(reason: string): string {
  const [code, ...rest] = reason.split(":");
  const label = REASON_LABELS[code.trim() as ReportReason];
  if (!label) return reason;
  const details = rest.join(":").trim();
  return details ? `${label} : ${details}` : label;
}

/** Who reported, as « Signalé par … » reads it. */
export function reporterRoleLabel(role: ReviewReport["reporterRole"]): string {
  if (role === "coiffeur") return "le salon";
  if (role === "particulier") return "un client";
  return "un admin";
}
