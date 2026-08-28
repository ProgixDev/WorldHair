import AsyncStorage from "@react-native-async-storage/async-storage";
import { isAxiosError } from "axios";
import { apiClient } from "../lib/apiClient";

/**
 * "Rendez-vous / Agenda" is real (see server/src/appointments/) — every
 * function below except the review ones calls the NestJS server. Reviews
 * stay mocked in AsyncStorage ("Avis" — a separate, un-built TODO.md
 * section): submitting one only updates this device's own local list,
 * cross-referenced against a real appointment by id.
 */

const REVIEWS_KEY = "@worldhair/reviews";

export type AppointmentStatus = "pending" | "confirmed" | "refused" | "cancelled" | "done";

export interface Appointment {
  id: string;
  salonId: string;
  salonName: string;
  serviceId: string | null;
  serviceName: string;
  /** ISO start. */
  startsAt: string;
  durationMin: number;
  price: number;
  status: AppointmentStatus;
  createdAt: string;
}

export interface UserReview {
  id: string;
  appointmentId: string;
  salonId: string;
  rating: number;
  /** Praise tags picked as chips. */
  tags: string[];
  comment: string;
  createdAt: string;
}

export type BookingErrorCode = "UNKNOWN_SERVICE" | "SLOT_TAKEN" | "NOT_FOUND";

export class BookingError extends Error {
  readonly code: BookingErrorCode;

  constructor(code: BookingErrorCode, message: string) {
    super(message);
    this.name = "BookingError";
    this.code = code;
  }
}

/**
 * The server's own rejection messages are English and meant for logs/devs
 * (see AppointmentsService) — this maps a failed request to a French,
 * user-facing one instead of surfacing them verbatim.
 */
function mapBookingError(err: unknown): never {
  if (isAxiosError(err)) {
    if (err.response?.status === 404) {
      throw new BookingError("UNKNOWN_SERVICE", "Salon ou prestation introuvable.");
    }
    if (err.response?.status === 400) {
      throw new BookingError(
        "SLOT_TAKEN",
        "Ce créneau n'est plus disponible. Choisissez un autre horaire.",
      );
    }
  }
  throw new BookingError("NOT_FOUND", "Réservation impossible. Réessayez.");
}

function delay(ms = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function newId(prefix: string): string {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 7)
  );
}

async function readList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

async function writeList<T>(key: string, value: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// ─── Appointments ────────────────────────────────────────────────────────────

export async function listAppointments(): Promise<Appointment[]> {
  const { data } = await apiClient.get<Appointment[]>("/appointments/me");
  return data;
}

export async function bookAppointment(params: {
  salonId: string;
  serviceId: string;
  startsAt: Date;
  note?: string;
}): Promise<Appointment> {
  try {
    const { data } = await apiClient.post<Appointment>("/appointments", {
      coiffeurId: params.salonId,
      serviceId: params.serviceId,
      startsAt: params.startsAt.toISOString(),
      note: params.note,
    });
    return data;
  } catch (err) {
    mapBookingError(err);
  }
}

export async function cancelAppointment(id: string): Promise<Appointment> {
  try {
    await apiClient.patch(`/appointments/${id}/cancel`);
  } catch (err) {
    mapBookingError(err);
  }
  const updated = (await listAppointments()).find((a) => a.id === id);
  if (!updated) throw new BookingError("NOT_FOUND", "Rendez-vous introuvable.");
  return updated;
}

/** Moves an existing appointment; the service (and price) stay the same. */
export async function rescheduleAppointment(id: string, startsAt: Date): Promise<Appointment> {
  try {
    const { data } = await apiClient.patch<Appointment>(`/appointments/${id}/reschedule`, {
      startsAt: startsAt.toISOString(),
    });
    return data;
  } catch (err) {
    mapBookingError(err);
  }
}

/** A still-active request/booking — the server already resolves "confirmed and past" to "done" (see AppointmentsService), so no date math is needed here. */
export function isUpcoming(appointment: Appointment): boolean {
  return appointment.status === "pending" || appointment.status === "confirmed";
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export interface PaymentReceipt {
  amount: number;
  /** ISO timestamp. */
  paidAt: string;
}

/**
 * Mocked pre-authorization: the amount is taken before the request even
 * reaches the coiffeur (issue #2 — pay-before-request, not pay-on-accept).
 * Real billing needs a provider decision (Apple/Google IAP vs a card
 * processor — see TODO.md); this only simulates latency and always succeeds.
 */
export async function payForAppointment(amount: number): Promise<PaymentReceipt> {
  await delay(900);
  return { amount, paidAt: new Date().toISOString() };
}

// ─── Reviews (still mock) ──────────────────────────────────────────────────

export async function listUserReviews(): Promise<UserReview[]> {
  return readList<UserReview>(REVIEWS_KEY);
}

export async function submitReview(params: {
  appointmentId: string;
  salonId: string;
  rating: number;
  tags: string[];
  comment: string;
}): Promise<UserReview> {
  await delay(600);
  const review: UserReview = {
    id: newId("rev"),
    appointmentId: params.appointmentId,
    salonId: params.salonId,
    rating: params.rating,
    tags: params.tags,
    comment: params.comment.trim(),
    createdAt: new Date().toISOString(),
  };

  const reviews = await listUserReviews();
  await writeList(REVIEWS_KEY, [...reviews, review]);
  return review;
}

/** Dev reset — wipes locally-tracked reviews (appointments are real now, nothing to reset client-side). */
export async function resetReviewData(): Promise<void> {
  await AsyncStorage.removeItem(REVIEWS_KEY);
}
