import { useEffect, useState } from "react";
import { apiClient } from "../../lib/apiClient";
import type { DaySlots } from "./slots";
import type { Coordinates } from "./geo";
import { searchParams, type MapBounds, type SalonFilters } from "./filters";
import type { Closure, ConfirmationMode, OpeningDay, Review, Salon, Service, SocialLinks, SpecialtyId } from "./types";

/**
 * Real search/detail (server/src/discovery/) replacing the old mock
 * catalogue (`./data`, deleted). Reviews are real too (server/src/reviews/)
 * — fetched alongside the detail call and embedded into the returned Salon.
 */

interface SalonSummaryResponse {
  id: string;
  salonName: string;
  stylist: string;
  tagline: string;
  description: string;
  addressLine: string;
  postalCode: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  specialties: SpecialtyId[];
  badges: string[];
  rating: number;
  reviewCount: number;
  coverUrl: string | null;
  priceFrom: number | null;
  onlineBooking?: boolean;
  nextSlot?: string | null;
  practiceZone?: "salon" | "domicile";
  travelRadiusKm?: number | null;
}

interface SalonServiceResponse {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMin: number;
  specialty: SpecialtyId;
}

interface AvailabilityResponse {
  weekday: number;
  isOpen: boolean;
  opensMinute: number;
  closesMinute: number;
  breakStartMinute: number | null;
  breakEndMinute: number | null;
}

interface SalonDetailResponse extends SalonSummaryResponse {
  services: SalonServiceResponse[];
  availability: AvailabilityResponse[];
  gallery: string[];
  confirmationMode: ConfirmationMode;
  bookingNoticeMinutes: number;
  cancellationNoticeMinutes: number;
  closures: Closure[];
  onlineBooking: boolean;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  tiktokUrl?: string | null;
  websiteUrl?: string | null;
}

interface SalonExtra {
  services: Service[];
  hours: OpeningDay[];
  reviews: Review[];
  gallery: string[];
  confirmationMode: ConfirmationMode;
  bookingNoticeMinutes: number;
  cancellationNoticeMinutes: number;
  closures: Closure[];
  socialLinks: SocialLinks;
}

interface SalonSearchResponse {
  items: SalonSummaryResponse[];
  total: number;
}

function toService(service: SalonServiceResponse): Service {
  return {
    id: service.id,
    name: service.name,
    price: service.price,
    durationMin: service.durationMin,
    specialty: service.specialty,
    description: service.description ?? undefined,
  };
}

function toHours(availability: AvailabilityResponse[]): OpeningDay[] {
  return availability.map((day) => ({
    weekday: day.weekday,
    opens: day.isOpen ? day.opensMinute : null,
    closes: day.isOpen ? day.closesMinute : null,
    breakStart: day.isOpen ? day.breakStartMinute : null,
    breakEnd: day.isOpen ? day.breakEndMinute : null,
  }));
}

interface ReviewResponse {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  reply?: string;
  createdAt: string;
  reportedByMe?: boolean;
  verified?: boolean;
}

function toReview(review: ReviewResponse): Review {
  return {
    id: review.id,
    author: review.authorName,
    rating: review.rating,
    date: review.createdAt,
    comment: review.comment,
    reply: review.reply,
    reportedByMe: review.reportedByMe ?? false,
    verified: review.verified ?? false,
  };
}

const NO_LINKS: SocialLinks = { instagram: null, facebook: null, tiktok: null, website: null };

function toSalon(summary: SalonSummaryResponse, extra?: SalonExtra): Salon {
  return {
    id: summary.id,
    name: summary.salonName,
    stylist: summary.stylist,
    tagline: summary.tagline,
    description: summary.description,
    badges: summary.badges,
    addressLine: summary.addressLine,
    postalCode: summary.postalCode,
    city: summary.city,
    // Falls back to 0,0 for the rare not-yet-geocoded coiffeur — no seeded
    // account is in that state today (see server/scripts/seed-catalogue-salons.ts).
    latitude: summary.latitude ?? 0,
    longitude: summary.longitude ?? 0,
    rating: summary.rating,
    reviewCount: summary.reviewCount,
    priceFrom: summary.priceFrom ?? 0,
    specialties: summary.specialties,
    services: extra?.services ?? [],
    reviews: extra?.reviews ?? [],
    hours: extra?.hours ?? [],
    gallery: extra?.gallery ?? [],
    // List items don't carry the rules; only the salon's own page shows them.
    confirmationMode: extra?.confirmationMode ?? "manual",
    bookingNoticeMinutes: extra?.bookingNoticeMinutes ?? 0,
    cancellationNoticeMinutes: extra?.cancellationNoticeMinutes ?? 0,
    closures: extra?.closures ?? [],
    onlineBooking: summary.onlineBooking ?? false,
    practiceZone: summary.practiceZone ?? "salon",
    travelRadiusKm: summary.travelRadiusKm ?? null,
    nextSlot: summary.nextSlot ?? null,
    socialLinks: extra?.socialLinks ?? NO_LINKS,
  };
}

export interface SalonPage {
  items: Salon[];
  /** Every match, beyond this page. */
  total: number;
}

/**
 * One page of the search, filtered and sorted by the server (TODO.md Phase
 * 6) — the list pages through them; the map passes the area it shows.
 */
export async function searchSalons(
  filters: SalonFilters,
  from: Coordinates | null,
  page: { limit: number; offset: number },
  bounds?: MapBounds,
): Promise<SalonPage> {
  const { data } = await apiClient.get<SalonSearchResponse>("/salons", {
    params: searchParams(filters, from, page, bounds),
  });
  return { items: data.items.map((item) => toSalon(item)), total: data.total };
}

/** How many salons these filters would show — the filter sheet's « Voir N salons ». The order doesn't change it, so none is asked. */
export async function countSalons(filters: SalonFilters, from: Coordinates | null): Promise<number> {
  return (await searchSalons({ ...filters, sort: "distance" }, from, { limit: 1, offset: 0 })).total;
}

// ─── Favorites ─────────────────────────────────────────────────────────────

/** The client's favorite salons, the latest first; distances from `from`. */
export async function fetchFavorites(from?: Coordinates): Promise<Salon[]> {
  const { data } = await apiClient.get<SalonSummaryResponse[]>("/favorites", {
    params: from ? { lat: from.latitude, lng: from.longitude } : undefined,
  });
  return data.map((item) => toSalon(item));
}

export async function addFavorite(salonId: string): Promise<void> {
  await apiClient.post("/favorites", { coiffeurId: salonId });
}

export async function removeFavorite(salonId: string): Promise<void> {
  await apiClient.delete(`/favorites/${salonId}`);
}

export async function fetchSalonById(id: string): Promise<Salon | undefined> {
  try {
    const [{ data }, reviews] = await Promise.all([
      apiClient.get<SalonDetailResponse>(`/salons/${id}`),
      fetchSalonReviews(id),
    ]);
    return toSalon(data, {
      services: data.services.map(toService),
      hours: toHours(data.availability),
      reviews,
      gallery: data.gallery,
      confirmationMode: data.confirmationMode ?? "manual",
      bookingNoticeMinutes: data.bookingNoticeMinutes ?? 0,
      cancellationNoticeMinutes: data.cancellationNoticeMinutes ?? 0,
      closures: data.closures ?? [],
      socialLinks: {
        instagram: data.instagramUrl ?? null,
        facebook: data.facebookUrl ?? null,
        tiktok: data.tiktokUrl ?? null,
        website: data.websiteUrl ?? null,
      },
    });
  } catch {
    return undefined;
  }
}

/** A salon's public reviews — also embedded into fetchSalonById's result, exported separately for pro/reviews.tsx's own mapping (same server shape, coiffeur-facing endpoint). */
export async function fetchSalonReviews(salonId: string): Promise<Review[]> {
  const { data } = await apiClient.get<ReviewResponse[]>(`/reviews/salon/${salonId}`);
  return data.map(toReview);
}

/** Feeds the manual "choisir une ville" fallback picker's result count / empty states, if ever needed — distinct cities among currently-visible salons. */
export async function fetchSalonCities(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>("/salons/cities");
  return data;
}

/**
 * The booking grid for one day, built by the server from the same rules that
 * accept a booking — so a free slot here is one the server takes. Pass the
 * prestations picked for a new booking, or the appointment being moved (its
 * own time then doesn't count as taken; a coiffeur moving it isn't held to
 * the booking notice).
 */
export async function fetchSlots(
  salonId: string,
  date: string,
  by: { serviceIds: string[] } | { appointmentId: string },
): Promise<DaySlots> {
  const params =
    "serviceIds" in by ? { date, serviceIds: by.serviceIds.join(",") } : { date, appointmentId: by.appointmentId };
  const { data } = await apiClient.get<DaySlots>(`/appointments/salon/${salonId}/slots`, { params });
  return data;
}

// ─── Lightweight shared cache for display-only lookups ─────────────────────
// A row that already has a salonId but needs more (address, cover) than the
// name/price snapshot it carries directly — not worth a loading state per row.

const cache = new Map<string, Salon>();

/**
 * Warms the shared cache for `id` and re-renders the calling component once
 * the fetch resolves. Returns whatever's cached synchronously (`undefined`
 * on the first render), matching the old mock `getSalonById`'s "may be
 * undefined" contract that every call site already handles.
 */
export function useSalonSummary(id: string | undefined): Salon | undefined {
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!id || cache.has(id)) return;
    let cancelled = false;
    fetchSalonById(id).then((salon) => {
      if (cancelled || !salon) return;
      cache.set(id, salon);
      forceRender((tick) => tick + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return id ? cache.get(id) : undefined;
}
