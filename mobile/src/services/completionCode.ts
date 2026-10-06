import { isAxiosError } from "axios";
import { apiClient } from "../lib/apiClient";
import { proErrorMessage } from "./pro";

/**
 * The end-of-service code, salon side (server/src/appointments/presence.*):
 * the salon — or the staff member whose booking it is — shows a QR code, the
 * client scans it with their own phone, and the booking reads « Confirmé par
 * le client ». It's proof of presence only: nothing here changes when the
 * salon is paid. All through the NestJS server.
 */

export interface CompletionCode {
  /** 12 letters and digits; the QR holds the website link that carries it (features/pro/presence.ts). */
  code: string;
  /** ISO — a code lives 5 minutes, and each request replaces the last one. */
  expiresAt: string;
}

/** A fresh code for a booking that has started — refused until then, after 12 h past its end, once absent or confirmed. */
export async function issueCompletionCode(appointmentId: string): Promise<CompletionCode> {
  const { data } = await apiClient.post<CompletionCode>(`/presence/${encodeURIComponent(appointmentId)}/code`);
  return data;
}

/** Has the client scanned yet? Cheap: the code's screen asks every few seconds. */
export async function getPresenceStatus(appointmentId: string): Promise<{ confirmedByClientAt: string | null }> {
  const { data } = await apiClient.get<{ confirmedByClientAt: string | null }>(
    `/presence/${encodeURIComponent(appointmentId)}/status`,
  );
  return data;
}

const FALLBACK = "Une erreur est survenue. Réessayez.";

function refusalOf(err: unknown): { status: number | undefined; message: string } | null {
  if (!isAxiosError(err) || !err.response) return null;
  const body = err.response.data as { message?: string | string[] } | undefined;
  const message = Array.isArray(body?.message) ? body.message.join(" ") : (body?.message ?? "");
  return { status: err.response.status, message };
}

/** The client confirmed between two checks: the screen then shows that, not an error. */
export function isAlreadyConfirmed(err: unknown): boolean {
  const refusal = refusalOf(err);
  return refusal?.status === 409 && refusal.message.startsWith("ALREADY_CONFIRMED");
}

/** A French message for a failed code or status call — the server's refusals are English and meant for logs. */
export function completionCodeErrorMessage(err: unknown): string {
  if (isAxiosError(err) && !err.response) return "Connexion impossible. Vérifiez votre réseau et réessayez.";
  const refusal = refusalOf(err);
  if (!refusal) return FALLBACK;

  const { status, message } = refusal;
  if (message.startsWith("ALREADY_CONFIRMED")) return "Le client a déjà confirmé ce rendez-vous.";
  if (message.includes("hasn't started yet")) return "Le rendez-vous n'a pas encore commencé.";
  if (message.includes("too long past")) return "Ce rendez-vous est trop ancien pour afficher un code.";
  if (message.includes("marked absent")) return "Ce rendez-vous est marqué absent.";
  if (message.includes("Only an accepted appointment")) return "Seul un rendez-vous accepté a un code de fin.";
  if (status === 403) return "Ce rendez-vous ne vous est pas attribué.";
  return proErrorMessage(err, FALLBACK);
}
