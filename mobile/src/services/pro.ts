import { isAxiosError } from "axios";
import { socialLink } from "../features/pro/links";
import { apiClient } from "../lib/apiClient";
import { supabase } from "../lib/supabase";
import {
  isRemoteUrl,
  removeGalleryPhotoFile,
  uploadGalleryPhoto,
  uploadUserPhoto,
} from "../lib/uploadPhoto";
import type {
  Attendance,
  AvailabilityDay,
  GalleryPhoto,
  ProAppointment,
  ProAppointmentStatus,
  ProProfile,
  PayoutStatus,
  ProService,
  Subscription,
  TimeOff,
  TimeOffConflict,
} from "../features/pro/types";
import type { ConfirmationMode, Review } from "../features/salons/types";
import { joinPhone, splitPhone } from "../utils/phoneFormat";

/**
 * The coiffeur area's data layer — profile, prestations, weekly hours,
 * appointments, reviews and subscription all go straight to the NestJS
 * server (`/salon/me/*`, `/appointments/*`, `/reviews/*`, `/subscriptions/*`
 * — see server/src/salon/, server/src/appointments/, server/src/reviews/,
 * server/src/subscriptions/) — real, persisted in Supabase. Real billing
 * (Stripe, sold on the website — TODO.md Phase 4) isn't wired up yet, only
 * plan/status/dates. Nothing here writes to Supabase tables directly: the
 * database refuses client writes except a user's own name and photo.
 */

async function currentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Aucune session active.");
  return user.id;
}

/** The server's refusals are English and meant for logs; these are what the coiffeur reads. */
const REFUSALS: [string, string][] = [
  ["no longer available", "Ce créneau est déjà pris."],
  ["already has an appointment", "Le client a déjà un rendez-vous à ce moment-là."],
  ["closed at that time", "Le salon est fermé à ce moment-là."],
  ["opening hours", "Cet horaire est en dehors de vos heures d'ouverture."],
  ["break", "Cet horaire tombe pendant votre pause."],
  ["valid date in the future", "Choisissez une date et une heure à venir."],
  ["already taken place", "Ce rendez-vous est déjà passé."],
  ["hasn't started yet", "Ce rendez-vous n'a pas encore commencé."],
  ["has expired", "Cette demande a expiré : son horaire est passé."],
  ["Only an accepted appointment", "Seul un rendez-vous accepté peut être modifié ainsi."],
  ["already started", "Ce rendez-vous a déjà commencé : il ne peut plus être déplacé."],
  [
    "already left a review",
    "Le client a déjà laissé un avis sur ce rendez-vous : il ne peut plus être marqué absent.",
  ],
  ["end after it starts", "La fermeture doit se terminer après son début."],
  ["Already paid out", "Le montant vous a déjà été versé : pour rembourser le client, contactez WorldHair."],
  ["being processed", "Un paiement est en cours sur ce rendez-vous. Réessayez dans une minute."],
  ["already been decided", "Cette demande a déjà été traitée, ou le client l'a annulée."],
  ["left to refund", "Montant trop élevé : il reste moins que ça à rembourser."],
  ["Nothing was paid in the app", "Ce rendez-vous n'a pas été payé dans l'application."],
  ["Finish setting up payouts", "Terminez d'abord la configuration de vos paiements."],
  ["instagramUrl", "Ce lien Instagram ne mène pas à Instagram."],
  ["facebookUrl", "Ce lien Facebook ne mène pas à Facebook."],
  ["tiktokUrl", "Ce lien TikTok ne mène pas à TikTok."],
  ["websiteUrl", "L'adresse du site web n'est pas valide."],
  ["already over", "Cette fermeture est déjà passée."],
];

/** A French, coiffeur-facing message for a failed action; `fallback` when the server's reason isn't one of these. */
export function proErrorMessage(err: unknown, fallback = "Une erreur est survenue. Réessayez."): string {
  if (isAxiosError(err)) {
    const body = err.response?.data as { message?: string | string[] } | undefined;
    const message = Array.isArray(body?.message) ? body.message.join(" ") : (body?.message ?? "");
    const match = REFUSALS.find(([key]) => message.includes(key));
    if (match) return match[1];
  }
  return fallback;
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
  phoneCountry: string | null;
  specialties: ProProfile["specialties"];
  coverUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  confirmationMode: ConfirmationMode;
  bookingNoticeMinutes: number;
  cancellationNoticeMinutes: number;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  tiktokUrl?: string | null;
  websiteUrl?: string | null;
  rating?: number;
  reviewCount?: number;
}

/**
 * One mapping for both the initial read and a save's response, so a save
 * hands back exactly what's now stored — pro/salon.tsx resets its draft to it.
 * `salonId`/`stylist` aren't part of this table (see getStylistName).
 */
function toProProfile(
  data: SalonProfileResponse,
  salonId: string,
  stylist: string,
): ProProfile {
  const { phone, phoneCountry } = splitPhone(data.phone, data.phoneCountry);
  return {
    // Used only as a deterministic image-hashing seed (coverFor/avatarFor) —
    // there's no shared mock-catalogue salon to point at anymore.
    salonId,
    name: data.salonName,
    stylist,
    tagline: data.tagline,
    description: data.description,
    addressLine: data.addressLine,
    postalCode: data.postalCode,
    city: data.city,
    phone,
    phoneCountry,
    specialties: data.specialties,
    coverUri: data.coverUrl,
    latitude: data.latitude,
    longitude: data.longitude,
    confirmationMode: data.confirmationMode ?? "manual",
    bookingNoticeMinutes: data.bookingNoticeMinutes ?? 60,
    cancellationNoticeMinutes: data.cancellationNoticeMinutes ?? 1440,
    instagramUrl: data.instagramUrl ?? "",
    facebookUrl: data.facebookUrl ?? "",
    tiktokUrl: data.tiktokUrl ?? "",
    websiteUrl: data.websiteUrl ?? "",
    rating: Number(data.rating ?? 0),
    reviewCount: data.reviewCount ?? 0,
  };
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
  return toProProfile(data, userId, stylist);
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
    phone: joinPhone(profile.phone, profile.phoneCountry),
    phoneCountry: profile.phoneCountry,
    specialties: profile.specialties,
    coverUrl: coverUrl ?? undefined,
    latitude: profile.latitude ?? undefined,
    longitude: profile.longitude ?? undefined,
    confirmationMode: profile.confirmationMode,
    bookingNoticeMinutes: profile.bookingNoticeMinutes,
    cancellationNoticeMinutes: profile.cancellationNoticeMinutes,
    instagramUrl: socialLink("instagram", profile.instagramUrl),
    facebookUrl: socialLink("facebook", profile.facebookUrl),
    tiktokUrl: socialLink("tiktok", profile.tiktokUrl),
    websiteUrl: socialLink("website", profile.websiteUrl),
  });

  return toProProfile(data, profile.salonId, profile.stylist);
}

// ─── Services (prestations) ───────────────────────────────────────────────────

interface SalonServiceResponse {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMin: number;
  specialty: ProService["specialty"];
  isActive?: boolean;
}

function fromResponse(service: SalonServiceResponse): ProService {
  return {
    id: service.id,
    name: service.name,
    price: service.price,
    durationMin: service.durationMin,
    specialty: service.specialty,
    description: service.description ?? undefined,
    isActive: service.isActive !== false,
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
    const { data } = await apiClient.post<SalonServiceResponse>("/salon/me/services", body);
    // Created visible; hidden straight away when the coiffeur switched it off first.
    if (service.isActive === false) await apiClient.patch(`/salon/me/services/${data.id}`, { isActive: false });
  } else {
    await apiClient.patch(`/salon/me/services/${service.id}`, { ...body, isActive: service.isActive !== false });
  }
  return listProServices();
}

export async function deleteProService(serviceId: string): Promise<ProService[]> {
  await apiClient.delete(`/salon/me/services/${serviceId}`);
  return listProServices();
}

// ─── Gallery ("Réalisations") ────────────────────────────────────────────────

export async function listGalleryPhotos(): Promise<GalleryPhoto[]> {
  const { data } = await apiClient.get<GalleryPhoto[]>("/salon/me/gallery");
  return data;
}

/** Uploads straight to Storage (same pattern as the cover photo), then indexes it server-side. */
export async function addGalleryPhoto(
  localUri: string,
  mimeType?: string | null,
): Promise<GalleryPhoto[]> {
  const userId = await currentUserId();
  const { url, storagePath } = await uploadGalleryPhoto(userId, localUri, mimeType);
  const { data } = await apiClient.post<GalleryPhoto[]>("/salon/me/gallery", {
    url,
    storagePath,
  });
  return data;
}

export async function deleteGalleryPhoto(photo: GalleryPhoto): Promise<GalleryPhoto[]> {
  // Best-effort: the server's own row delete below is what the UI actually
  // reflects, so a Storage hiccup here never blocks the photo from going away.
  await removeGalleryPhotoFile(photo.storagePath).catch(() => undefined);
  const { data } = await apiClient.delete<GalleryPhoto[]>(`/salon/me/gallery/${photo.id}`);
  return data;
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

/** "Déplacer" an accepted appointment; the client gets a push with the new time. */
export async function moveAppointment(id: string, startsAt: string): Promise<ProAppointment[]> {
  await apiClient.patch(`/appointments/${id}/move`, { startsAt });
  return listProAppointments();
}

/** "Honoré" or "Absent", once the appointment has started. No review after a no-show. */
export async function setAttendance(id: string, attendance: Attendance): Promise<ProAppointment[]> {
  await apiClient.patch(`/appointments/${id}/attendance`, { attendance });
  return listProAppointments();
}

/** Gives the client money back — everything, or `amount` euros — until the salon has been paid. */
export async function refundAppointment(id: string, amount?: number): Promise<ProAppointment[]> {
  await apiClient.post(`/appointments/${id}/refund`, amount === undefined ? {} : { amount });
  return listProAppointments();
}

// ─── Payouts (Stripe Connect) ────────────────────────────────────────────────

export async function getPayoutStatus(): Promise<PayoutStatus> {
  const { data } = await apiClient.get<PayoutStatus>("/payments/connect/status");
  return data;
}

/** Stripe's own onboarding page (identity, bank details) — opened in the browser, never filled in here. */
export async function createPayoutOnboardingLink(): Promise<string> {
  const { data } = await apiClient.post<{ url: string }>("/payments/connect/onboarding-link");
  return data.url;
}

/** Stripe's Express dashboard: the salon's transfers, payouts and bank details. */
export async function createPayoutDashboardLink(): Promise<string> {
  const { data } = await apiClient.post<{ url: string }>("/payments/connect/dashboard-link");
  return data.url;
}

// ─── Closures (congés, fermetures exceptionnelles) ───────────────────────────

export async function listTimeOff(): Promise<TimeOff[]> {
  const { data } = await apiClient.get<TimeOff[]>("/salon/me/time-off");
  return data;
}

/** Adds a closure; bookings already inside it aren't cancelled — they come back as `conflicts` to handle one by one. */
export async function addTimeOff(input: {
  startsAt: string;
  endsAt: string;
  label?: string;
}): Promise<{ timeOff: TimeOff[]; conflicts: TimeOffConflict[] }> {
  const { data } = await apiClient.post<{ timeOff: TimeOff; conflicts: TimeOffConflict[] }>(
    "/salon/me/time-off",
    input,
  );
  return { timeOff: await listTimeOff(), conflicts: data.conflicts };
}

export async function deleteTimeOff(id: string): Promise<TimeOff[]> {
  await apiClient.delete(`/salon/me/time-off/${id}`);
  return listTimeOff();
}

// ─── Subscription ────────────────────────────────────────────────────────────

/** Read-only: subscriptions are sold and managed on the website, through Stripe. */
export async function getSubscription(): Promise<Subscription> {
  const { data } = await apiClient.get<Subscription>("/subscriptions/mine");
  return {
    state: data.state,
    plan: data.plan,
    listed: data.listed,
    offered: data.offered,
    trialEndsAt: data.trialEndsAt,
    currentPeriodEnd: data.currentPeriodEnd,
    endsAt: data.endsAt,
  };
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

interface ReviewApiResponse {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  reply?: string;
  createdAt: string;
  status?: Review["status"];
  reportedByMe?: boolean;
}

function toReview(review: ReviewApiResponse): Review {
  return {
    id: review.id,
    author: review.authorName,
    rating: review.rating,
    date: review.createdAt,
    comment: review.comment,
    reply: review.reply,
    status: review.status ?? "visible",
    reportedByMe: review.reportedByMe ?? false,
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
