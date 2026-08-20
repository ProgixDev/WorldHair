import AsyncStorage from "@react-native-async-storage/async-storage";
import { getSalonById, getServiceById } from "../features/salons/data";

/**
 * Mock booking + reviews store. Same contract as `services/auth.ts`: everything
 * lives in AsyncStorage behind this module, so the real API replaces one file.
 */

const APPOINTMENTS_KEY = "@worldhair/appointments";
const REVIEWS_KEY = "@worldhair/reviews";

export type AppointmentStatus = "confirmed" | "cancelled";

export interface Appointment {
  id: string;
  salonId: string;
  serviceId: string;
  /** ISO start. */
  startsAt: string;
  durationMin: number;
  price: number;
  status: AppointmentStatus;
  createdAt: string;
  /** Set once the user has rated this appointment. */
  reviewId?: string | null;
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
  const appointments = await readList<Appointment>(APPOINTMENTS_KEY);
  return appointments.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function bookAppointment(params: {
  salonId: string;
  serviceId: string;
  startsAt: Date;
}): Promise<Appointment> {
  await delay(700);
  const service = getServiceById(params.salonId, params.serviceId);
  if (!service)
    throw new BookingError("UNKNOWN_SERVICE", "Prestation introuvable.");

  const appointments = await listAppointments();
  const startsAt = params.startsAt.toISOString();
  if (
    appointments.some(
      (a) => a.status === "confirmed" && a.startsAt === startsAt,
    )
  )
    throw new BookingError("SLOT_TAKEN", "Ce créneau vient d'être pris.");

  const appointment: Appointment = {
    id: newId("apt"),
    salonId: params.salonId,
    serviceId: params.serviceId,
    startsAt,
    durationMin: service.durationMin,
    price: service.price,
    status: "confirmed",
    createdAt: new Date().toISOString(),
    reviewId: null,
  };

  await writeList(APPOINTMENTS_KEY, [...appointments, appointment]);
  return appointment;
}

export async function cancelAppointment(id: string): Promise<Appointment> {
  await delay(400);
  const appointments = await listAppointments();
  const appointment = appointments.find((a) => a.id === id);
  if (!appointment)
    throw new BookingError("NOT_FOUND", "Rendez-vous introuvable.");

  const updated: Appointment = { ...appointment, status: "cancelled" };
  await writeList(
    APPOINTMENTS_KEY,
    appointments.map((a) => (a.id === id ? updated : a)),
  );
  return updated;
}

/** Moves an existing appointment; the service (and price) stay the same. */
export async function rescheduleAppointment(
  id: string,
  startsAt: Date,
): Promise<Appointment> {
  await delay(600);
  const appointments = await listAppointments();
  const appointment = appointments.find((a) => a.id === id);
  if (!appointment)
    throw new BookingError("NOT_FOUND", "Rendez-vous introuvable.");

  const updated: Appointment = {
    ...appointment,
    startsAt: startsAt.toISOString(),
    status: "confirmed",
  };
  await writeList(
    APPOINTMENTS_KEY,
    appointments.map((a) => (a.id === id ? updated : a)),
  );
  return updated;
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

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

  const [reviews, appointments] = await Promise.all([
    listUserReviews(),
    listAppointments(),
  ]);

  await Promise.all([
    writeList(REVIEWS_KEY, [...reviews, review]),
    writeList(
      APPOINTMENTS_KEY,
      appointments.map((a) =>
        a.id === params.appointmentId ? { ...a, reviewId: review.id } : a,
      ),
    ),
  ]);

  return review;
}

// ─── Derived helpers (pure) ──────────────────────────────────────────────────

export function endsAt(appointment: Appointment): Date {
  return new Date(
    new Date(appointment.startsAt).getTime() + appointment.durationMin * 60000,
  );
}

/** A confirmed appointment whose end time has passed counts as done. */
export function isPast(appointment: Appointment, now = new Date()): boolean {
  return endsAt(appointment).getTime() < now.getTime();
}

export function isUpcoming(
  appointment: Appointment,
  now = new Date(),
): boolean {
  return appointment.status === "confirmed" && !isPast(appointment, now);
}

/** Appointments still waiting for a rating — feeds the review prompt. */
export function awaitingReview(
  appointments: Appointment[],
  now = new Date(),
): Appointment[] {
  return appointments.filter(
    (a) => a.status === "confirmed" && isPast(a, now) && !a.reviewId,
  );
}

/** Salon name resolved from the catalogue, for list rows. */
export function salonNameFor(appointment: Appointment): string {
  return getSalonById(appointment.salonId)?.name ?? "Salon";
}

export function serviceNameFor(appointment: Appointment): string {
  return (
    getServiceById(appointment.salonId, appointment.serviceId)?.name ??
    "Prestation"
  );
}

/** Dev reset — wipes bookings and reviews. */
export async function resetBookingData(): Promise<void> {
  await AsyncStorage.multiRemove([APPOINTMENTS_KEY, REVIEWS_KEY]);
}
