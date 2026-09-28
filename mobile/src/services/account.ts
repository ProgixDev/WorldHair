import { isAxiosError } from "axios";
import { apiClient } from "../lib/apiClient";

/**
 * « Mes données » (TODO.md Phase 8) — server/src/account/ and
 * server/src/users/: the terms accepted, the data exported, the account
 * deleted.
 */

/** « J'accepte » the CGU and privacy policy in force. */
export async function acceptTerms(): Promise<void> {
  await apiClient.post("/users/me/terms");
}

/** Everything WorldHair holds on this account, as readable JSON to share. */
export async function exportMyData(): Promise<string> {
  const { data } = await apiClient.get<unknown>("/users/me/export");
  return JSON.stringify(data, null, 2);
}

/**
 * Deletes the account for good: bookings still to come cancelled and
 * refunded, a salon paid what it's owed and its subscription ended, files
 * and personal data erased. The session is then signed out by the caller.
 */
export async function deleteMyAccount(): Promise<void> {
  await apiClient.delete("/users/me");
}

/** In French, for the sheet: a step the server couldn't finish (503) deleted nothing, and can be tried again. */
export function accountErrorMessage(err: unknown): string {
  if (isAxiosError(err) && err.response?.status === 503) {
    return "Votre compte n'a pas pu être supprimé pour l'instant : rien n'a été effacé. Réessayez dans quelques minutes.";
  }
  return "Une erreur est survenue. Vérifiez votre connexion et réessayez.";
}
