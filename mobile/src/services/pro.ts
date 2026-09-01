import { apiClient } from "../lib/apiClient";
import { supabase } from "../lib/supabase";
import { isRemoteUrl, uploadUserPhoto } from "../lib/uploadPhoto";
import type {
  AvailabilityDay,
  PlanId,
  ProAppointment,
  ProAppointmentStatus,
  ProProfile,
  ProService,
  Subscription,
} from "../features/pro/types";
import type { Review } from "../features/salons/types";

/**
 * The coiffeur area's data layer — profile, prestations, weekly hours,
 * appointments, reviews and subscription all go straight to the NestJS
 * server (`/salon/me/*`, `/appointments/*`, `/reviews/*`, `/subscriptions/*`
 * — see server/src/salon/, server/src/appointments/, server/src/reviews/,
 * server/src/subscriptions/) — real, persisted in Supabase. Real billing
 * itself (Apple IAP / Google Play Billing, separate TODO.md section) isn't
 * wired up — only plan/status/dates are.
 */

async function currentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Aucune session active.");
  return user.id;
}

// ─── Seeding ─────────────────────────────────────────────────────────────────

/**
 * Ensures a subscription row exists — the server lazily creates a 30-day
 * trial on first read (`getOrCreateMine`), so this just triggers that.
 */
export async function seedProWorkspace(): Promise<void> {
  await getSubscription();
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

// ─── Appointments ────────────────────────────────────────────────────────────

export async function listProAppointments(): Promise<ProAppointment[]> {
  const { data } = await apiClient.get<ProAppointment[]>("/appointments/salon");
  return data;
}

/** Only ever called with "confirmed"/"refused" (accepting or refusing a pending request) or "cancelled" — never "pending"/"done", which aren't decisions a coiffeur makes. */
export async function setAppointmentStatus(
  id: string,
  status: ProAppointmentStatus,
): Promise<ProAppointment[]> {
  if (status === "confirmed" || status === "refused") {
    await apiClient.patch(`/appointments/${id}/decide`, { decision: status });
  } else if (status === "cancelled") {
    await apiClient.patch(`/appointments/${id}/cancel`);
  }
  return listProAppointments();
}

// ─── Subscription ────────────────────────────────────────────────────────────

interface SubscriptionApiResponse {
  profileId: string;
  plan: PlanId;
  status: "trial" | "active" | "cancelled";
  trialEndsAt: string | null;
  renewsAt: string;
}

function toSubscription(row: SubscriptionApiResponse): Subscription {
  return { plan: row.plan, status: row.status, trialEndsAt: row.trialEndsAt, renewsAt: row.renewsAt };
}

export async function getSubscription(): Promise<Subscription> {
  const { data } = await apiClient.get<SubscriptionApiResponse>("/subscriptions/mine");
  return toSubscription(data);
}

export async function changePlan(plan: PlanId): Promise<Subscription> {
  const { data } = await apiClient.patch<SubscriptionApiResponse>("/subscriptions/mine/plan", {
    plan,
  });
  return toSubscription(data);
}

export async function cancelSubscription(): Promise<Subscription> {
  const { data } = await apiClient.patch<SubscriptionApiResponse>("/subscriptions/mine/cancel");
  return toSubscription(data);
}

export async function reactivateSubscription(): Promise<Subscription> {
  const { data } = await apiClient.patch<SubscriptionApiResponse>(
    "/subscriptions/mine/reactivate",
  );
  return toSubscription(data);
}

/**
 * Dev-only demo tool (J-7 banner / expired block, issue #8) — writes
 * straight to Supabase rather than the NestJS server: RLS lets a coiffeur
 * update their own `coiffeur_subscriptions` row (see schema.sql), same as
 * this app already does for profiles elsewhere. Deliberately bypasses
 * changePlan()'s renewal-date rules — the whole point is to force an
 * arbitrary end date.
 */
export async function debugSetSubscriptionEnd(
  daysFromNow: number,
  status: "trial" | "cancelled",
): Promise<Subscription> {
  const userId = await currentUserId();
  const end = new Date();
  end.setDate(end.getDate() + daysFromNow);

  const { error } = await supabase
    .from("coiffeur_subscriptions")
    .update({ status, trial_ends_at: end.toISOString(), renews_at: end.toISOString() })
    .eq("profile_id", userId);
  if (error) throw error;

  return getSubscription();
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

interface ReviewApiResponse {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  reply?: string;
  createdAt: string;
}

function toReview(review: ReviewApiResponse): Review {
  return {
    id: review.id,
    author: review.authorName,
    rating: review.rating,
    date: review.createdAt,
    comment: review.comment,
    reply: review.reply,
  };
}

/** Every review of this coiffeur, any status — the management view (unlike the public salon page, which only sees non-hidden ones). */
export async function listProReviews(): Promise<Review[]> {
  const { data } = await apiClient.get<ReviewApiResponse[]>("/reviews/salon/mine");
  return data.map(toReview);
}

export async function saveReply(reviewId: string, text: string): Promise<Review[]> {
  await apiClient.patch(`/reviews/${reviewId}/reply`, { text: text.trim() });
  return listProReviews();
}

export async function deleteReply(reviewId: string): Promise<Review[]> {
  await apiClient.delete(`/reviews/${reviewId}/reply`);
  return listProReviews();
}

/** Dev reset — regenerates a fresh 30-day trial subscription; doesn't touch the real profile/services/availability/appointments/reviews. */
export async function resetProWorkspace(): Promise<void> {
  const userId = await currentUserId();
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);

  const { error } = await supabase.from("coiffeur_subscriptions").upsert({
    profile_id: userId,
    plan: "monthly",
    status: "trial",
    trial_ends_at: trialEndsAt.toISOString(),
    renews_at: trialEndsAt.toISOString(),
  });
  if (error) throw error;
}
