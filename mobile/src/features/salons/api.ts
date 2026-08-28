import { useEffect, useState } from "react";
import { apiClient } from "../../lib/apiClient";
import type { OpeningDay, Review, Salon, Service, SpecialtyId } from "./types";

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
}

interface SalonDetailResponse extends SalonSummaryResponse {
  services: SalonServiceResponse[];
  availability: AvailabilityResponse[];
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
  }));
}

interface ReviewResponse {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  reply?: string;
  createdAt: string;
}

function toReview(review: ReviewResponse): Review {
  return {
    id: review.id,
    author: review.authorName,
    rating: review.rating,
    date: review.createdAt,
    comment: review.comment,
    reply: review.reply,
  };
}

function toSalon(
  summary: SalonSummaryResponse,
  extra?: { services: Service[]; hours: OpeningDay[]; reviews: Review[] },
): Salon {
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
  };
}

/**
 * Every visible salon. Distance, specialty/text filters and sorting all
 * stay client-side (see features/salons/geo.ts, filters.ts) so re-filtering
 * or moving the map never needs a round trip — this is the discover/search
 * screens' one shared fetch.
 */
export async function fetchSalons(): Promise<Salon[]> {
  const { data } = await apiClient.get<SalonSearchResponse>("/salons", { params: { limit: 100 } });
  return data.items.map((item) => toSalon(item));
}

export async function fetchSalonById(id: string): Promise<Salon | undefined> {
  try {
    const [{ data }, reviews] = await Promise.all([
      apiClient.get<SalonDetailResponse>(`/salons/${id}`),
      fetchSalonReviews(id),
    ]);
    return toSalon(data, { services: data.services.map(toService), hours: toHours(data.availability), reviews });
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
 * Starts already held by *anyone* at this salon (pending or confirmed, no
 * client identity) — feeds the booking flow's slot picker so a slot someone
 * else already holds shows as unavailable too, not just the caller's own.
 */
export async function fetchBusySlots(salonId: string): Promise<string[]> {
  const { data } = await apiClient.get<{ startsAt: string; durationMin: number }[]>(
    `/appointments/salon/${salonId}/busy`,
  );
  return data.map((slot) => slot.startsAt);
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
