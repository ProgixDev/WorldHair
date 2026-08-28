import { isAxiosError } from "axios";
import { apiClient } from "../lib/apiClient";

/**
 * "Rendez-vous / Agenda" and "Avis" are both real now (see
 * server/src/appointments/ and server/src/reviews/) — every function below
 * calls the NestJS server.
 */

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

// ─── Reviews ─────────────────────────────────────────────────────────────────

interface ReviewApiResponse {
  id: string;
  appointmentId: string;
  rating: number;
  tags: string[];
  comment: string;
  createdAt: string;
}

function toUserReview(review: ReviewApiResponse): UserReview {
  return {
    id: review.id,
    appointmentId: review.appointmentId,
    rating: review.rating,
    tags: review.tags,
    comment: review.comment,
    createdAt: review.createdAt,
  };
}

export async function listUserReviews(): Promise<UserReview[]> {
  const { data } = await apiClient.get<ReviewApiResponse[]>("/reviews/me");
  return data.map(toUserReview);
}

export async function submitReview(params: {
  appointmentId: string;
  rating: number;
  tags: string[];
  comment: string;
}): Promise<UserReview> {
  const { data } = await apiClient.post<ReviewApiResponse>("/reviews", {
    appointmentId: params.appointmentId,
    rating: params.rating,
    tags: params.tags,
    comment: params.comment.trim(),
  });
  return toUserReview(data);
}
