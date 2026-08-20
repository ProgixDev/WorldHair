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

// ─── Demo seeding ────────────────────────────────────────────────────────────

interface SeedSpec {
  salonId: string;
  /** Days from today; negative is in the past. */
  dayOffset: number;
  hour: number;
  minute: number;
  status: AppointmentStatus;
  /** Seeds a matching review so the history is not uniformly unrated. */
  review?: { rating: number; tags: string[]; comment: string };
}

const DEMO_SEEDS: SeedSpec[] = [
  // Upcoming
  {
    salonId: "studio-w",
    dayOffset: 1,
    hour: 10,
    minute: 30,
    status: "confirmed",
  },
  {
    salonId: "le-comptoir-barbier",
    dayOffset: 4,
    hour: 18,
    minute: 0,
    status: "confirmed",
  },
  {
    salonId: "maison-tresse",
    dayOffset: 11,
    hour: 11,
    minute: 0,
    status: "confirmed",
  },
  // Recent past, still waiting for a rating
  {
    salonId: "eclat-marais",
    dayOffset: -3,
    hour: 15,
    minute: 30,
    status: "confirmed",
  },
  {
    salonId: "barbe-noire",
    dayOffset: -19,
    hour: 19,
    minute: 0,
    status: "confirmed",
  },
  // Cancelled, kept in the history
  {
    salonId: "coupe-carre",
    dayOffset: -8,
    hour: 9,
    minute: 30,
    status: "cancelled",
  },
  // Past and already rated
  {
    salonId: "racines",
    dayOffset: -12,
    hour: 16,
    minute: 30,
    status: "confirmed",
    review: {
      rating: 5,
      tags: ["Écoute", "Résultat"],
      comment:
        "Diagnostic hyper précis, mes boucles n'ont jamais été aussi définies.",
    },
  },
  {
    salonId: "atelier-nuance",
    dayOffset: -27,
    hour: 14,
    minute: 0,
    status: "confirmed",
    review: {
      rating: 4,
      tags: ["Ponctualité", "Conseils"],
      comment: "Couleur très réussie, prévoir large sur la durée.",
    },
  },
  {
    salonId: "boucles-libres",
    dayOffset: -41,
    hour: 12,
    minute: 0,
    status: "confirmed",
    review: {
      rating: 5,
      tags: ["Ambiance", "Résultat", "Conseils"],
      comment: "Routine expliquée pas à pas, je tiens enfin mes boucles.",
    },
  },
  {
    salonId: "onde",
    dayOffset: -63,
    hour: 11,
    minute: 30,
    status: "confirmed",
    review: {
      rating: 3,
      tags: ["Propreté"],
      comment: "Brushing joli mais tenu deux jours seulement.",
    },
  },
];

/**
 * Fills the local store so a demo account lands on a lived-in agenda instead
 * of three empty states. Idempotent: it never touches an account that already
 * has bookings.
 */
export async function seedDemoBookings(): Promise<void> {
  const existing = await listAppointments();
  if (existing.length > 0) return;

  const appointments: Appointment[] = [];
  const reviews: UserReview[] = [];

  DEMO_SEEDS.forEach((seed, index) => {
    const salon = getSalonById(seed.salonId);
    const service = salon?.services[index % (salon.services.length || 1)];
    if (!salon || !service) return;

    const startsAt = new Date();
    startsAt.setDate(startsAt.getDate() + seed.dayOffset);
    startsAt.setHours(seed.hour, seed.minute, 0, 0);

    const id = "apt_demo_" + index;
    const review = seed.review
      ? {
          id: "rev_demo_" + index,
          appointmentId: id,
          salonId: salon.id,
          rating: seed.review.rating,
          tags: seed.review.tags,
          comment: seed.review.comment,
          createdAt: new Date(
            startsAt.getTime() + service.durationMin * 60000,
          ).toISOString(),
        }
      : null;

    if (review) reviews.push(review);

    appointments.push({
      id,
      salonId: salon.id,
      serviceId: service.id,
      startsAt: startsAt.toISOString(),
      durationMin: service.durationMin,
      price: service.price,
      status: seed.status,
      createdAt: new Date(startsAt.getTime() - 5 * 86400000).toISOString(),
      reviewId: review?.id ?? null,
    });
  });

  await Promise.all([
    writeList(APPOINTMENTS_KEY, appointments),
    writeList(REVIEWS_KEY, reviews),
  ]);
}

/** Dev reset — wipes bookings and reviews. */
export async function resetBookingData(): Promise<void> {
  await AsyncStorage.multiRemove([APPOINTMENTS_KEY, REVIEWS_KEY]);
}
