import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient } from "../lib/apiClient";
import { supabase } from "../lib/supabase";
import { isRemoteUrl, uploadUserPhoto } from "../lib/uploadPhoto";
import {
  seedAppointments,
  seedProServices as seedMockCatalogueServices,
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
 * The coiffeur area's data layer, split by how real it is:
 *  - Profile, prestations and weekly hours go straight to the NestJS server
 *    (`/salon/me/*`, see server/src/salon/) — real, persisted in Supabase.
 *  - Appointments, subscription and review replies stay mocked in
 *    AsyncStorage — "Rendez-vous/Agenda", "Paiements/Abonnements" and "Avis"
 *    don't have a backend yet (separate TODO.md sections).
 * `seedMockExtras()` only seeds that second group now; the first group's
 * defaults come from the server itself (an empty profile, a sensible
 * default week, no services yet).
 */

const KEYS = {
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

async function currentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Aucune session active.");
  return user.id;
}

// ─── Seeding (mock extras only) ───────────────────────────────────────────────

/**
 * Fills the mock-only part of the pro store (appointments, subscription,
 * replies) so the dashboard/agenda/account tabs have numbers to show.
 * Idempotent, and independent of whether the real profile/services/
 * availability have been filled in yet. Appointments are still generated
 * against the static mock salon catalogue purely as random-assignment
 * fodder — unrelated to a coiffeur's own real `coiffeur_services` rows,
 * which start empty until "Rendez-vous/Agenda" gets its own real backend.
 */
export async function seedProWorkspace(): Promise<void> {
  const existing = await AsyncStorage.getItem(KEYS.subscription);
  if (existing) return;

  const catalogueServices = seedMockCatalogueServices();
  await Promise.all([
    write(KEYS.appointments, seedAppointments(catalogueServices)),
    write(KEYS.subscription, seedSubscription()),
    write(KEYS.replies, [] as ReviewReply[]),
  ]);
}

// ─── Profile ─────────────────────────────────────────────────────────────────

interface SalonProfileResponse {
  salonName: string;
  tagline: string;
  description: string;
  addressLine: string;
  postalCode: string;
  city: string;
  phone: string;
  specialties: ProProfile["specialties"];
  coverUrl: string | null;
}

/** The one particulier-facing display field (see pro/account.tsx) this table doesn't itself store — pulled from the coiffeur's own application. */
async function getStylistName(): Promise<string> {
  try {
    const { data } = await apiClient.get<{ firstName: string; lastName: string }>(
      "/coiffeur/applications/me",
    );
    return `${data.firstName} ${data.lastName}`.trim();
  } catch {
    return "";
  }
}

export async function getProProfile(): Promise<ProProfile> {
  const [{ data }, userId, stylist] = await Promise.all([
    apiClient.get<SalonProfileResponse>("/salon/me"),
    currentUserId(),
    getStylistName(),
  ]);

  return {
    // Used only as a deterministic image-hashing seed (coverFor/avatarFor) —
    // there's no shared mock-catalogue salon to point at anymore.
    salonId: userId,
    name: data.salonName,
    stylist,
    tagline: data.tagline,
    description: data.description,
    addressLine: data.addressLine,
    postalCode: data.postalCode,
    city: data.city,
    phone: data.phone,
    specialties: data.specialties,
    coverUri: data.coverUrl,
  };
}

export async function saveProProfile(profile: ProProfile): Promise<ProProfile> {
  let coverUrl = profile.coverUri ?? null;
  if (coverUrl && !isRemoteUrl(coverUrl)) {
    const userId = await currentUserId();
    coverUrl = await uploadUserPhoto(userId, "salon-cover", coverUrl);
  }

  const { data } = await apiClient.patch<SalonProfileResponse>("/salon/me", {
    salonName: profile.name,
    tagline: profile.tagline,
    description: profile.description,
    addressLine: profile.addressLine,
    postalCode: profile.postalCode,
    city: profile.city,
    phone: profile.phone,
    specialties: profile.specialties,
    coverUrl: coverUrl ?? undefined,
  });

  return {
    ...profile,
    tagline: data.tagline,
    description: data.description,
    coverUri: data.coverUrl,
  };
}

// ─── Services (prestations) ───────────────────────────────────────────────────

interface SalonServiceResponse {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMin: number;
  specialty: ProService["specialty"];
}

function fromResponse(service: SalonServiceResponse): ProService {
  return {
    id: service.id,
    name: service.name,
    price: service.price,
    durationMin: service.durationMin,
    specialty: service.specialty,
    description: service.description ?? undefined,
  };
}

export async function listProServices(): Promise<ProService[]> {
  const { data } = await apiClient.get<SalonServiceResponse[]>("/salon/me/services");
  return data.map(fromResponse);
}

/** A not-yet-saved draft's placeholder — `saveProService` treats any id not already in the real list as "new" and creates instead of updating. */
export function newServiceId(): string {
  return "new_" + Date.now().toString(36);
}

export async function saveProService(service: ProService): Promise<ProService[]> {
  const existing = await listProServices();
  const isNew = !existing.some((item) => item.id === service.id);
  const body = {
    name: service.name,
    description: service.description,
    price: service.price,
    durationMin: service.durationMin,
    specialty: service.specialty,
  };

  if (isNew) {
    await apiClient.post("/salon/me/services", body);
  } else {
    await apiClient.patch(`/salon/me/services/${service.id}`, body);
  }
  return listProServices();
}

export async function deleteProService(serviceId: string): Promise<ProService[]> {
  await apiClient.delete(`/salon/me/services/${serviceId}`);
  return listProServices();
}

// ─── Availability ──────────────────────────────────────────────────────────

interface AvailabilityResponse {
  weekday: number;
  isOpen: boolean;
  opensMinute: number;
  closesMinute: number;
  breakStartMinute: number | null;
  breakEndMinute: number | null;
}

function fromAvailabilityResponse(day: AvailabilityResponse): AvailabilityDay {
  return {
    weekday: day.weekday,
    open: day.isOpen,
    opens: day.opensMinute,
    closes: day.closesMinute,
    breakStart: day.breakStartMinute,
    breakEnd: day.breakEndMinute,
  };
}

export async function getAvailability(): Promise<AvailabilityDay[]> {
  const { data } = await apiClient.get<AvailabilityResponse[]>("/salon/me/availability");
  return data.map(fromAvailabilityResponse);
}

export async function saveAvailability(
  availability: AvailabilityDay[],
): Promise<AvailabilityDay[]> {
  const { data } = await apiClient.put<AvailabilityResponse[]>("/salon/me/availability", {
    days: availability.map((day) => ({
      weekday: day.weekday,
      isOpen: day.open,
      opensMinute: day.opens,
      closesMinute: day.closes,
      breakStartMinute: day.breakStart,
      breakEndMinute: day.breakEnd,
    })),
  });
  return data.map(fromAvailabilityResponse);
}

// ─── Appointments (still mock) ────────────────────────────────────────────────

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

// ─── Subscription (still mock) ────────────────────────────────────────────────

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

// ─── Review replies (still mock) ───────────────────────────────────────────────

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

/** Dev reset — wipes the mock-only part of the pro workspace (appointments/subscription/replies), not the real profile/services/availability. */
export async function resetProWorkspace(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
