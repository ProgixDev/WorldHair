import { isAxiosError } from "axios";
import { apiClient } from "../lib/apiClient";
import type { Attendance, ProAppointment } from "../features/pro/types";
import { proErrorMessage } from "./pro";

/**
 * A coiffeur working in someone else's salon (TODO.md Phase 3) — joining it
 * with the owner's code, where they work, leaving, and their own agenda.
 * All through the NestJS server (server/src/staff/): the team tables are
 * API-only, the database lets the app read none of them.
 */

/** Where a staff account works. */
export interface StaffMembership {
  staffId: string;
  salonId: string;
  salonName: string;
}

interface MembershipResponse extends StaffMembership {
  isOwner: boolean;
}

/** The owner's code: « Équipe › Inviter » in his app, one use, 7 days. */
export const INVITE_CODE_LENGTH = 6;

/** The code as the server wants it — capitals, letters and digits only — however it was typed or pasted. */
export function normalizeInviteCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, INVITE_CODE_LENGTH);
}

function toMembership(response: MembershipResponse): StaffMembership {
  return { staffId: response.staffId, salonId: response.salonId, salonName: response.salonName };
}

/** « Rejoindre un salon »: this account becomes one of the salon's team (role `staff`) — no dossier, the owner vouches. */
export async function joinSalon(code: string): Promise<StaffMembership> {
  const { data } = await apiClient.post<MembershipResponse>("/staff/join", { code: normalizeInviteCode(code) });
  return toMembership(data);
}

/** `null`: a staff account no longer in a salon (left, or removed by the owner). */
export async function getMyMembership(): Promise<StaffMembership | null> {
  const { data } = await apiClient.get<{ membership: MembershipResponse | null }>("/staff/me");
  return data.membership ? toMembership(data.membership) : null;
}

/** Refused (STAFF_HAS_BOOKINGS) while bookings to come are theirs: the owner reassigns them first. */
export async function leaveSalon(): Promise<void> {
  await apiClient.post("/staff/me/leave");
}

/** Their own accepted bookings, past and to come — read-only, `payment` always `null`. */
export async function listMyAppointments(): Promise<ProAppointment[]> {
  const { data } = await apiClient.get<ProAppointment[]>("/staff/me/appointments");
  return data;
}

/** « Honoré » or « Absent », once the booking has started — the one thing a staff member changes. */
export async function setMyAttendance(id: string, attendance: Attendance): Promise<ProAppointment[]> {
  await apiClient.patch(`/appointments/${id}/attendance`, { attendance });
  return listMyAppointments();
}

const FALLBACK = "Une erreur est survenue. Réessayez.";

/** A French message for a failed join, leave or mark — the server's refusals are English and meant for logs. */
export function staffErrorMessage(err: unknown): string {
  if (!isAxiosError(err)) return FALLBACK;
  if (!err.response) return "Connexion impossible. Vérifiez votre réseau et réessayez.";

  const body = err.response.data as { message?: string | string[] } | undefined;
  const message = Array.isArray(body?.message) ? body.message.join(" ") : (body?.message ?? "");
  const status = err.response.status;

  if (message.startsWith("INVALID_CODE")) {
    return "Ce code n'existe pas, a déjà servi ou a expiré. Demandez-en un nouveau au salon.";
  }
  if (message.startsWith("ALREADY_IN_SALON")) {
    return "Votre compte fait déjà partie d'un salon : quittez-le d'abord pour en rejoindre un autre.";
  }
  if (message.startsWith("STAFF_HAS_BOOKINGS")) {
    return "Des rendez-vous à venir sont encore à votre nom : demandez au salon de les réattribuer à quelqu'un d'autre, puis réessayez.";
  }
  if (message.startsWith("Not in a salon")) return "Vous ne faites plus partie de ce salon.";
  // class-validator on the join body: « code must be longer than or equal to 6 characters »…
  if (status === 400 && /\bcode\b/.test(message)) return "Le code fait 6 caractères, lettres et chiffres.";
  if (status === 403) return "Action impossible depuis ce compte.";
  // Honoré/absent: the same refusals the salon's owner reads.
  return proErrorMessage(err, FALLBACK);
}
