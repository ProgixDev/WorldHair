import { isAxiosError } from "axios";
import type { CancelledBy } from "../features/appointments/cancellation";
import { apiClient } from "../lib/apiClient";

/**
 * "Rendez-vous / Agenda" and "Avis" are both real now (see
 * server/src/appointments/ and server/src/reviews/) — every function below
 * calls the NestJS server.
 */

/** "awaiting_payment": the slot is held while the client pays — never listed, the salon doesn't see it yet. */
export type AppointmentStatus = "awaiting_payment" | "pending" | "confirmed" | "refused" | "cancelled" | "done";

/** Set by the salon once the appointment has started. */
export type Attendance = "attended" | "no_show";

/** One prestation of a booking — several run back to back as one appointment. */
export interface AppointmentLine {
  serviceId: string | null;
  name: string;
  price: number;
  durationMin: number;
}

export interface Appointment {
  id: string;
  /** Null once the salon deleted its account: the booking stays in the history as « Salon supprimé ». */
  salonId: string | null;
  salonName: string;
  /** First prestation (see `services` for all of them). */
  serviceId: string | null;
  /** Every prestation's name, joined: "Couleur + Coupe & brushing". */
  serviceName: string;
  /** ISO start. */
  startsAt: string;
  /** Total of every prestation. */
  durationMin: number;
  /** Total of every prestation. */
  price: number;
  services: AppointmentLine[];
  status: AppointmentStatus;
  attendance: Attendance | null;
  /** Until when it can still be cancelled or moved: the salon's deadline, never later than the start. */
  modifiableUntil: string | null;
  /** The salon moved it: it stays changeable until it starts, whatever the salon's deadline. */
  movedBySalon: boolean;
  /** What was paid in the app, and refunded since; `null` for a booking made before payments. */
  payment: { amount: number; refundedAmount: number } | null;
  /** Who cancelled it; `null` unless cancelled. */
  cancelledBy?: CancelledBy | null;
  /** WorldHair's reason, when it cancelled (a dispute). */
  cancellationReason?: string | null;
  createdAt: string;
}

/** POST /appointments: the slot held for the client, and what Stripe's payment sheet needs. */
export interface HeldBooking {
  appointment: Appointment;
  /** Stripe's payment page for the held slot, opened in the browser. */
  payment: { url: string; amount: number };
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

export type BookingErrorCode =
  | "UNKNOWN_SERVICE"
  | "SLOT_TAKEN"
  | "ALREADY_INACTIVE"
  | "TOO_LATE"
  | "NOT_BOOKABLE"
  | "NOT_FOUND";

export class BookingError extends Error {
  readonly code: BookingErrorCode;

  constructor(code: BookingErrorCode, message: string) {
    super(message);
    this.name = "BookingError";
    this.code = code;
  }
}

function extractServerMessage(err: unknown): string {
  if (!isAxiosError(err)) return "";
  const body = err.response?.data as { message?: string | string[] } | undefined;
  const message = body?.message;
  if (Array.isArray(message)) return message.join(" ");
  return typeof message === "string" ? message : "";
}

/**
 * The server's own rejection messages are English and meant for logs/devs
 * (see AppointmentsService) — this maps a failed request to a French,
 * user-facing one, based on the ACTUAL reason the server gave rather than
 * the HTTP status alone: a 400 covers several unrelated cases (slot taken,
 * outside opening hours, inside the lunch break, the appointment no longer
 * being active, a past date, ...), and blindly mapping every 400 to "this
 * slot is no longer available" — the previous behavior — showed that exact
 * message when *cancelling* an already-cancelled/refused appointment, which
 * makes no sense for a cancel action at all.
 */
function mapBookingError(err: unknown): never {
  if (isAxiosError(err)) {
    if (err.response?.status === 404) {
      throw new BookingError("UNKNOWN_SERVICE", "Salon ou prestation introuvable.");
    }
    if (err.response?.status === 400) {
      const message = extractServerMessage(err);

      if (message.includes("can no longer be modified")) {
        throw new BookingError(
          "ALREADY_INACTIVE",
          "Ce rendez-vous a déjà été annulé, refusé ou modifié.",
        );
      }
      if (message.includes("already taken place")) {
        throw new BookingError("ALREADY_INACTIVE", "Ce rendez-vous est déjà passé.");
      }
      if (message.includes("online bookings")) {
        throw new BookingError("NOT_BOOKABLE", "Ce salon ne prend pas encore de réservation en ligne.");
      }
      if (message.includes("Too late")) {
        throw new BookingError(
          "TOO_LATE",
          "Il est trop tard pour annuler ou modifier ce rendez-vous : le délai fixé par le salon est passé.",
        );
      }
      if (message.includes("more notice")) {
        throw new BookingError(
          "SLOT_TAKEN",
          "Ce créneau est trop proche : ce salon demande de réserver un peu plus tôt.",
        );
      }
      if (message.includes("closed at that time")) {
        throw new BookingError("SLOT_TAKEN", "Le salon est fermé à ce moment-là.");
      }
      if (message.includes("already have an appointment")) {
        throw new BookingError(
          "SLOT_TAKEN",
          "Vous avez déjà un rendez-vous à ce moment-là.",
        );
      }
      if (message.includes("at least one service")) {
        throw new BookingError("UNKNOWN_SERVICE", "Choisissez au moins une prestation.");
      }
      if (message.includes("opening hours")) {
        throw new BookingError(
          "SLOT_TAKEN",
          "Cet horaire est en dehors des heures d'ouverture du salon.",
        );
      }
      if (message.includes("break")) {
        throw new BookingError(
          "SLOT_TAKEN",
          "Cet horaire tombe pendant la pause du salon.",
        );
      }
      if (message.includes("valid date in the future")) {
        throw new BookingError(
          "SLOT_TAKEN",
          "Choisissez une date et une heure dans le futur.",
        );
      }
      // Default 400: genuinely "someone else already took this slot".
      throw new BookingError(
        "SLOT_TAKEN",
        "Ce créneau n'est plus disponible. Choisissez un autre horaire.",
      );
    }
  }
  throw new BookingError("NOT_FOUND", "Une erreur est survenue. Réessayez.");
}

// ─── Appointments ────────────────────────────────────────────────────────────

export async function listAppointments(): Promise<Appointment[]> {
  const { data } = await apiClient.get<Appointment[]>("/appointments/me");
  return data;
}

/**
 * Holds the slot for one or several prestations back to back, and gets
 * what Stripe's payment sheet needs to charge them. The salon only sees
 * the request once it's paid (`confirmPayment`).
 */
export async function bookAppointment(params: {
  salonId: string;
  serviceIds: string[];
  startsAt: Date;
  note?: string;
}): Promise<HeldBooking> {
  try {
    const { data } = await apiClient.post<HeldBooking>("/appointments", {
      coiffeurId: params.salonId,
      serviceIds: params.serviceIds,
      startsAt: params.startsAt.toISOString(),
      note: params.note,
    });
    return data;
  } catch (err) {
    mapBookingError(err);
  }
}

/** After Stripe's payment sheet: the server checks with Stripe and sends the request to the salon. */
export async function confirmPayment(id: string): Promise<Appointment> {
  const { data } = await apiClient.post<Appointment>(`/appointments/${id}/payment/confirm`);
  return data;
}

/** Leaving the payment step: the held slot goes back to everyone (it would expire on its own anyway). */
export async function releaseHold(id: string): Promise<void> {
  try {
    await apiClient.post(`/appointments/${id}/release`);
  } catch {
    // Released server-side after 15 minutes regardless.
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

/** Still active and before the salon's cancellation deadline — "Modifier" and "Annuler" are offered. */
export function canStillChange(appointment: Appointment, now = new Date()): boolean {
  if (!isUpcoming(appointment)) return false;
  return (
    appointment.modifiableUntil === null ||
    now.getTime() <= new Date(appointment.modifiableUntil).getTime()
  );
}

// ─── Payment ─────────────────────────────────────────────────────────────────

function euros(amount: number): string {
  return (Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(".", ",")) + " €";
}

/** "Payé 40 €", "Remboursé 40 €", "Remboursé 15,50 € sur 40 €" — `null` when nothing was paid in the app. */
export function paymentLabel(appointment: Appointment): string | null {
  const payment = appointment.payment;
  if (!payment) return null;
  if (payment.refundedAmount <= 0) return "Payé " + euros(payment.amount);
  if (payment.refundedAmount >= payment.amount) return "Remboursé " + euros(payment.amount);
  return "Remboursé " + euros(payment.refundedAmount) + " sur " + euros(payment.amount);
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
