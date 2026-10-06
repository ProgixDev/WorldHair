import { isAxiosError } from "axios";
import { apiClient } from "../lib/apiClient";

/**
 * The end-of-service code, client side (server/src/appointments/presence.*):
 * the client scans the salon's QR code with their phone's camera, the link
 * opens the app (app/rdv/[code].tsx), and this tells the server they were
 * there. Proof of presence only — nothing here changes when the salon is
 * paid. All through the NestJS server.
 */

/** What the confirmation screen says. */
export interface PresenceConfirmation {
  appointmentId: string;
  salonName: string;
  serviceName: string;
  startsAt: string;
  confirmedAt: string;
}

/** Twelve letters or digits, as the server makes them. */
export const PRESENCE_CODE_LENGTH = 12;

/**
 * The code as the server wants it — capitals, no spaces or dashes — however
 * the link was opened or pasted. Empty when it can't be a code (not twelve
 * characters), so the screen never asks the server about it.
 */
export function normalizePresenceCode(raw: string): string {
  let text = raw;
  try {
    text = decodeURIComponent(raw);
  } catch {
    // Not URL-encoded after all: read as it is.
  }
  const code = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code.length === PRESENCE_CODE_LENGTH ? code : "";
}

export async function confirmPresence(code: string): Promise<PresenceConfirmation> {
  const { data } = await apiClient.post<PresenceConfirmation>("/presence/confirm", {
    code: normalizePresenceCode(code),
  });
  return data;
}

const FALLBACK = "Une erreur est survenue. Vérifiez votre connexion et réessayez.";

/** A French message for a refused scan — the server's refusals are English and meant for logs. */
export function presenceErrorMessage(err: unknown): string {
  if (!isAxiosError(err) || !err.response) return FALLBACK;
  const body = err.response.data as { message?: string | string[] } | undefined;
  const message = Array.isArray(body?.message) ? body.message.join(" ") : (body?.message ?? "");
  if (message.startsWith("INVALID_CODE")) {
    return "Ce code n'est plus valable. Demandez au salon d'en afficher un nouveau.";
  }
  if (message.startsWith("NOT_YOUR_APPOINTMENT")) {
    return "Ce code correspond à un rendez-vous d'un autre compte. Connectez-vous avec le compte qui a réservé.";
  }
  if (message.startsWith("NOT_CONFIRMED")) return "Ce rendez-vous n'est plus en cours.";
  return FALLBACK;
}
