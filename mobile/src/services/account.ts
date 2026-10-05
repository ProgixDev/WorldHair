import { isAxiosError } from "axios";
import { apiClient } from "../lib/apiClient";

/**
 * « Mes données » (TODO.md Phase 8) — server/src/account/ and
 * server/src/users/: the terms accepted, the data exported, the account
 * deleted.
 */

/**
 * Whether this account accepted the CGU and privacy policy in force — the
 * server's word, whatever version this build of the app knows. Anything
 * that isn't a clear answer (offline, signed out) doesn't hold the user up.
 */
export async function termsUpToDate(): Promise<boolean> {
  try {
    const { data } = await apiClient.get<{ termsUpToDate?: boolean }>("/users/me");
    return data.termsUpToDate !== false;
  } catch {
    return true;
  }
}

/** « J'accepte » the CGU and privacy policy in force. */
export async function acceptTerms(): Promise<void> {
  await apiClient.post("/users/me/terms");
}

/** Past this, the phone's share sheet can't carry the export (Android refuses it): a download link instead. */
export const SHAREABLE_EXPORT_CHARS = 300_000;

/** Everything WorldHair holds on this account, as readable JSON. */
export async function exportMyData(): Promise<string> {
  const { data } = await apiClient.get<unknown>("/users/me/export");
  return JSON.stringify(data, null, 2);
}

/** The same export as a file, behind a link valid ten minutes. */
export async function exportLink(): Promise<string> {
  const { data } = await apiClient.post<{ url: string }>("/users/me/export/link");
  return data.url;
}

/**
 * Deletes the account for good: bookings still to come cancelled and
 * refunded, a salon paid what it's owed and its subscription ended, files
 * and personal data erased. The session is then signed out by the caller.
 */
export async function deleteMyAccount(): Promise<void> {
  await apiClient.delete("/users/me");
}

/**
 * After a deletion that didn't answer (a timeout, the app sent to the
 * background): the server may well have finished. Gone means signed out.
 */
export async function accountStillExists(): Promise<boolean> {
  try {
    await apiClient.get("/users/me");
    return true;
  } catch (err) {
    return !(isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 404));
  }
}

/** In French, for the deletion sheet. */
export function accountErrorMessage(err: unknown): string {
  const status = isAxiosError(err) ? err.response?.status : undefined;
  const body = isAxiosError(err) ? (err.response?.data as { message?: unknown } | undefined) : undefined;
  // A salon's team member (TODO.md Phase 3): their bookings to come go to someone else first.
  if (status === 409 && typeof body?.message === "string" && body.message.startsWith("STAFF_HAS_BOOKINGS")) {
    return "Des rendez-vous à venir sont encore à votre nom : demandez au salon de les réattribuer à quelqu'un d'autre, puis réessayez.";
  }
  if (status === 409) {
    return "Des paiements de vos clients vous sont dus, mais vos encaissements ne sont pas actifs : activez-les (Compte › Paiements) avant de supprimer votre compte, ou écrivez-nous.";
  }
  if (status === 503) {
    return "La suppression n'a pas pu aller jusqu'au bout. Réessayez dans quelques minutes : ce qui a déjà été fait (annulations, remboursements) ne sera pas refait.";
  }
  return "Une erreur est survenue. Vérifiez votre connexion et réessayez.";
}
