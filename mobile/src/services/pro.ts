import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  seedAppointments,
  seedAvailability,
  seedProProfile,
  seedProServices,
  seedSubscription,
} from "../features/pro/seed";
import type {
  AvailabilityDay,
  PlanId,
  ProAppointment,
  ProAppointmentStatus,
  ProProfile,
  ProService,
  ReviewReply,
  Subscription,
} from "../features/pro/types";

/**
 * Mock store for the coiffeur area — same seam as `services/auth.ts` and
 * `services/booking.ts`. Everything the pro edits (page, prestations, agenda,
 * abonnement, réponses aux avis) lives here until a backend exists.
 */

const KEYS = {
  profile: "@worldhair/pro_profile",
  services: "@worldhair/pro_services",
  availability: "@worldhair/pro_availability",
  appointments: "@worldhair/pro_appointments",
  subscription: "@worldhair/pro_subscription",
  replies: "@worldhair/pro_replies",
} as const;

function delay(ms = 350): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function write<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// ─── Seeding ─────────────────────────────────────────────────────────────────

/**
 * Fills the pro store on first entry so the dashboard has numbers to show.
 * Idempotent: an account that already has a profile is left untouched.
 */
export async function seedProWorkspace(): Promise<void> {
  const existing = await AsyncStorage.getItem(KEYS.profile);
  if (existing) return;

  const services = seedProServices();
  await Promise.all([
    write(KEYS.profile, seedProProfile()),
    write(KEYS.services, services),
    write(KEYS.availability, seedAvailability()),
    write(KEYS.appointments, seedAppointments(services)),
    write(KEYS.subscription, seedSubscription()),
    write(KEYS.replies, [] as ReviewReply[]),
  ]);
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getProProfile(): Promise<ProProfile> {
  await seedProWorkspace();
  return read(KEYS.profile, seedProProfile());
}

export async function saveProProfile(profile: ProProfile): Promise<ProProfile> {
  await delay();
  await write(KEYS.profile, profile);
  return profile;
}

// ─── Services ────────────────────────────────────────────────────────────────

export async function listProServices(): Promise<ProService[]> {
  await seedProWorkspace();
  return read(KEYS.services, []);
}

export async function saveProService(
  service: ProService,
): Promise<ProService[]> {
  await delay(250);
  const services = await listProServices();
  const exists = services.some((item) => item.id === service.id);
  const next = exists
    ? services.map((item) => (item.id === service.id ? service : item))
    : [...services, service];
  await write(KEYS.services, next);
  return next;
}

export async function deleteProService(
  serviceId: string,
): Promise<ProService[]> {
  await delay(200);
  const services = await listProServices();
  const next = services.filter((service) => service.id !== serviceId);
  await write(KEYS.services, next);
  return next;
}

/** New services need an id that will not collide with the catalogue ones. */
export function newServiceId(): string {
  return "pro_svc_" + Date.now().toString(36);
}

// ─── Availability ────────────────────────────────────────────────────────────

export async function getAvailability(): Promise<AvailabilityDay[]> {
  await seedProWorkspace();
  return read(KEYS.availability, seedAvailability());
}

export async function saveAvailability(
  availability: AvailabilityDay[],
): Promise<AvailabilityDay[]> {
  await write(KEYS.availability, availability);
  return availability;
}

// ─── Appointments ────────────────────────────────────────────────────────────

export async function listProAppointments(): Promise<ProAppointment[]> {
  await seedProWorkspace();
  const appointments = await read<ProAppointment[]>(KEYS.appointments, []);
  return appointments.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function setAppointmentStatus(
  id: string,
  status: ProAppointmentStatus,
): Promise<ProAppointment[]> {
  await delay(250);
  const appointments = await listProAppointments();
  const next = appointments.map((appointment) =>
    appointment.id === id ? { ...appointment, status } : appointment,
  );
  await write(KEYS.appointments, next);
  return next;
}

// ─── Subscription ────────────────────────────────────────────────────────────

export async function getSubscription(): Promise<Subscription> {
  await seedProWorkspace();
  return read(KEYS.subscription, {
    plan: "monthly" as PlanId,
    status: "trial" as const,
    trialEndsAt: null,
    renewsAt: new Date().toISOString(),
  });
}

/**
 * Plan switch. Real billing goes through Apple/Google in-app purchase (see
 * TODO.md); this only moves the local state so the screen can be exercised.
 */
export async function changePlan(plan: PlanId): Promise<Subscription> {
  await delay(600);
  const current = await getSubscription();
  const renewsAt = new Date();
  if (current.status === "trial" && current.trialEndsAt)
    renewsAt.setTime(new Date(current.trialEndsAt).getTime());
  else if (plan === "yearly") renewsAt.setFullYear(renewsAt.getFullYear() + 1);
  else renewsAt.setMonth(renewsAt.getMonth() + 1);

  const next: Subscription = {
    ...current,
    plan,
    status: current.status === "cancelled" ? "active" : current.status,
    renewsAt: renewsAt.toISOString(),
  };
  await write(KEYS.subscription, next);
  return next;
}

export async function cancelSubscription(): Promise<Subscription> {
  await delay(400);
  const current = await getSubscription();
  const next: Subscription = { ...current, status: "cancelled" };
  await write(KEYS.subscription, next);
  return next;
}

export async function reactivateSubscription(): Promise<Subscription> {
  await delay(400);
  const current = await getSubscription();
  const next: Subscription = {
    ...current,
    status: current.trialEndsAt ? "trial" : "active",
  };
  await write(KEYS.subscription, next);
  return next;
}

/**
 * Dev-only: fast-forwards the subscription's end date so the J-7 banner and
 * the expired block (issue #8) can be exercised without waiting real days.
 */
export async function debugSetSubscriptionEnd(
  daysFromNow: number,
  status: "trial" | "cancelled",
): Promise<Subscription> {
  const current = await getSubscription();
  const end = new Date();
  end.setDate(end.getDate() + daysFromNow);
  const next: Subscription = {
    ...current,
    status,
    trialEndsAt: end.toISOString(),
    renewsAt: end.toISOString(),
  };
  await write(KEYS.subscription, next);
  return next;
}

// ─── Review replies ──────────────────────────────────────────────────────────

export async function listReplies(): Promise<ReviewReply[]> {
  await seedProWorkspace();
  return read(KEYS.replies, []);
}

export async function saveReply(
  reviewId: string,
  text: string,
): Promise<ReviewReply[]> {
  await delay(400);
  const replies = await listReplies();
  const reply: ReviewReply = {
    reviewId,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
  const next = [...replies.filter((item) => item.reviewId !== reviewId), reply];
  await write(KEYS.replies, next);
  return next;
}

export async function deleteReply(reviewId: string): Promise<ReviewReply[]> {
  await delay(200);
  const replies = await listReplies();
  const next = replies.filter((item) => item.reviewId !== reviewId);
  await write(KEYS.replies, next);
  return next;
}

/** Dev reset — wipes the whole pro workspace. */
export async function resetProWorkspace(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
