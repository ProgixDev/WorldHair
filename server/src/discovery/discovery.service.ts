import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { NextSlotQuery, NextSlotService } from '../appointments/next-slot.service';
import { CoiffeurApplicationsService } from '../coiffeur/coiffeur-applications.service';
import { isAccountActive } from '../common/utils/account-status';
import { isSalonListed } from '../common/utils/subscription-status';
import { SupabaseService } from '../database/supabase.service';
import { PayoutAccountsService } from '../payments/payout-accounts.service';
import { ConfirmationMode, Specialty } from '../salon/dto/update-salon-profile.dto';
import { AvailabilityDay, PracticeZone, SalonService, SalonServiceItem } from '../salon/salon.service';

export interface SalonSummary {
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
  phone: string;
  specialties: Specialty[];
  badges: string[];
  rating: number;
  reviewCount: number;
  coverUrl: string | null;
  priceFrom: number | null;
  distanceKm: number | null;
  /** In a salon, or at the client's home within `travelRadiusKm`. */
  practiceZone: PracticeZone;
  travelRadiusKm: number | null;
  /** Bookable and payable in the app: the salon's Stripe payouts are on (TODO.md Phase 5). */
  onlineBooking: boolean;
  /** When it can next take its shortest prestation (ISO), within two weeks; `null` if not bookable online or full. */
  nextSlot: string | null;
}

export interface SalonDetail extends SalonSummary {
  services: SalonServiceItem[];
  availability: AvailabilityDay[];
  gallery: string[];
  /** The salon's booking rules, shown to the client before and while booking. */
  confirmationMode: ConfirmationMode;
  bookingNoticeMinutes: number;
  cancellationNoticeMinutes: number;
  /** Upcoming closures (just the times — their labels are the coiffeur's own notes). */
  closures: { startsAt: string; endsAt: string }[];
  /** The salon's pages elsewhere. */
  instagramUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
  websiteUrl: string | null;
}

export interface SalonSearchResult {
  items: SalonSummary[];
  total: number;
}

export type SalonSort = 'distance' | 'rating' | 'price' | 'availability';

export interface SearchSalonsParams {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  /** Any of them. */
  specialties?: Specialty[];
  city?: string;
  /** Every word, accents aside: salon, coiffeur, tagline, address, city, prestations. */
  query?: string;
  /** A visible prestation priced within the range. */
  priceMin?: number;
  priceMax?: number;
  /** Open at `now`, Paris time: its hours, not on its break, not closed. */
  openNow?: boolean;
  /** Open that Paris day (YYYY-MM-DD). */
  openOn?: string;
  /** Still open after this minute of the day (Paris): on `openOn`, or any day. */
  openAfter?: number;
  practiceZone?: PracticeZone;
  /** The map's visible area: [minLat, minLng, maxLat, maxLng]. */
  bounds?: [number, number, number, number];
  /** Only these salons (the favorites). */
  ids?: string[];
  sort?: SalonSort;
  limit: number;
  offset: number;
  /** When "open now" and each next free slot are judged; now by default. */
  now?: Date;
  /** Next free slots are worked out unless `false` (the city picker needs none). */
  withNextSlots?: boolean;
}

/** Sorting by availability ranks the nearest matches this many at most: their next slots are worked out one by one. */
export const AVAILABILITY_CANDIDATES = 200;

interface SearchSalonRow {
  profile_id: string;
  salon_name: string;
  stylist_first_name: string;
  stylist_last_name: string;
  tagline: string;
  description: string;
  address_line: string;
  postal_code: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  specialties: string[];
  badges: string[];
  rating: number | string;
  review_count: number;
  cover_url: string | null;
  price_from: number | string | null;
  shortest_duration_min: number | null;
  practice_zone: string;
  travel_radius_km: number | null;
  booking_notice_minutes: number;
  online_booking: boolean;
  distance_km: number | string | null;
  total_count: number;
}

interface ProfileRow {
  salon_name: string;
  tagline: string;
  description: string;
  address_line: string;
  postal_code: string;
  city: string;
  phone: string;
  specialties: string[];
  cover_url: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | string;
  review_count: number;
  badges: string[];
  confirmation_mode: string;
  booking_notice_minutes: number;
  cancellation_notice_minutes: number;
  practice_zone: string | null;
  travel_radius_km: number | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  website_url: string | null;
}

function nextSlotQuery(row: SearchSalonRow): NextSlotQuery {
  return {
    salonId: row.profile_id,
    durationMin: row.shortest_duration_min,
    bookingNoticeMinutes: row.booking_notice_minutes,
    onlineBooking: row.online_booking,
  };
}

/** Soonest free first, the unbookable last; equals keep their order (distance). */
function bySoonest(a: SalonSummary, b: SalonSummary): number {
  if (a.nextSlot === b.nextSlot) return 0;
  if (a.nextSlot === null) return 1;
  if (b.nextSlot === null) return -1;
  return a.nextSlot.localeCompare(b.nextSlot);
}

function mapSearchRow(row: SearchSalonRow, nextSlot: string | null): SalonSummary {
  return {
    id: row.profile_id,
    salonName: row.salon_name,
    stylist: `${row.stylist_first_name} ${row.stylist_last_name}`.trim(),
    tagline: row.tagline,
    description: row.description,
    addressLine: row.address_line,
    postalCode: row.postal_code,
    city: row.city,
    latitude: row.latitude,
    longitude: row.longitude,
    phone: row.phone,
    specialties: row.specialties as Specialty[],
    badges: row.badges,
    rating: Number(row.rating),
    reviewCount: row.review_count,
    coverUrl: row.cover_url,
    priceFrom: row.price_from == null ? null : Number(row.price_from),
    distanceKm: row.distance_km == null ? null : Number(row.distance_km),
    practiceZone: (row.practice_zone ?? 'salon') as PracticeZone,
    travelRadiusKm: row.travel_radius_km ?? null,
    onlineBooking: row.online_booking,
    nextSlot,
  };
}

/**
 * Public salon search/detail — TODO.md "Recherche & géolocalisation". Reads
 * only, over the same coiffeur_profiles/coiffeur_services/coiffeur_availability
 * tables SalonService (the coiffeur's OWN "Mon salon" workspace) writes.
 * Only coiffeurs with a validated, shop-complete application are visible
 * here — see search_salons() in schema.sql and getById() below.
 */
@Injectable()
export class DiscoveryService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly applications: CoiffeurApplicationsService,
    private readonly salon: SalonService,
    private readonly payouts: PayoutAccountsService,
    private readonly nextSlots: NextSlotService,
  ) {}

  /**
   * Filtered, sorted and paged by the database (search_salons), however many
   * salons there are. Sorting by availability ranks the nearest
   * AVAILABILITY_CANDIDATES matches by their next free slot, worked out here.
   */
  async search(params: SearchSalonsParams): Promise<SalonSearchResult> {
    const now = params.now ?? new Date();
    const byAvailability = params.sort === 'availability';
    const { data, error } = await this.supabase.client.rpc('search_salons', {
      p_lat: params.lat ?? null,
      p_lng: params.lng ?? null,
      p_radius_km: params.radiusKm ?? null,
      p_specialties: params.specialties?.length ? params.specialties : null,
      p_city: params.city ?? null,
      p_query: params.query?.trim() || null,
      p_price_min: params.priceMin ?? null,
      p_price_max: params.priceMax ?? null,
      p_open_now: params.openNow ?? false,
      p_open_on: params.openOn ?? null,
      p_open_after: params.openAfter ?? null,
      p_practice_zone: params.practiceZone ?? null,
      p_bounds: params.bounds ?? null,
      p_ids: params.ids ?? null,
      p_sort: byAvailability ? 'distance' : (params.sort ?? 'distance'),
      p_now: now.toISOString(),
      p_limit: byAvailability ? AVAILABILITY_CANDIDATES : params.limit,
      p_offset: byAvailability ? 0 : params.offset,
    });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    const rows = data as SearchSalonRow[];
    const nextSlots =
      params.withNextSlots === false ? new Map<string, string | null>() : await this.nextSlots.nextSlots(rows.map(nextSlotQuery), now);
    const items = rows.map((row) => mapSearchRow(row, nextSlots.get(row.profile_id) ?? null));
    const total = Number(rows[0]?.total_count ?? 0);
    if (!byAvailability) return { items, total };
    return {
      items: [...items].sort(bySoonest).slice(params.offset, params.offset + params.limit),
      total: Math.min(total, items.length),
    };
  }

  /** Distinct cities among currently-visible salons — feeds the manual-location picker. */
  async listCities(): Promise<string[]> {
    const { items } = await this.search({ limit: 500, offset: 0, withNextSlots: false });
    const cities = new Set(items.map((item) => item.city).filter((city) => city.length > 0));
    return [...cities].sort();
  }

  async getById(profileId: string, now = new Date()): Promise<SalonDetail> {
    const [application, accountActive, listed] = await Promise.all([
      this.applications.getMine(profileId),
      isAccountActive(this.supabase, profileId),
      isSalonListed(this.supabase, profileId),
    ]);
    if (
      !application ||
      application.status !== 'validated' ||
      !application.shopProfileComplete ||
      !accountActive ||
      !listed
    ) {
      throw new NotFoundException('Salon not found');
    }

    const { data, error } = await this.supabase.client
      .from('coiffeur_profiles')
      .select()
      .eq('profile_id', profileId)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException('Salon not found');
    }
    const row = data as ProfileRow;

    const [services, availability, gallery, closures, onlineBooking] = await Promise.all([
      this.salon.listServices(profileId, { activeOnly: true }),
      this.salon.getAvailability(profileId),
      this.salon.listGalleryPhotos(profileId),
      this.salon.listTimeOff(profileId),
      this.payouts.isBookable(profileId),
    ]);
    const nextSlots = await this.nextSlots.nextSlots(
      [
        {
          salonId: profileId,
          durationMin: services.length > 0 ? Math.min(...services.map((service) => service.durationMin)) : null,
          bookingNoticeMinutes: row.booking_notice_minutes ?? 0,
          onlineBooking,
        },
      ],
      now,
    );

    return {
      id: profileId,
      salonName: row.salon_name,
      stylist: `${application.firstName} ${application.lastName}`.trim(),
      tagline: row.tagline,
      description: row.description,
      addressLine: row.address_line,
      postalCode: row.postal_code,
      city: row.city,
      latitude: row.latitude,
      longitude: row.longitude,
      phone: row.phone,
      specialties: row.specialties as Specialty[],
      badges: row.badges,
      rating: Number(row.rating),
      reviewCount: row.review_count,
      coverUrl: row.cover_url,
      priceFrom: services.length > 0 ? Math.min(...services.map((s) => s.price)) : null,
      distanceKm: null,
      practiceZone: (row.practice_zone ?? 'salon') as PracticeZone,
      travelRadiusKm: row.travel_radius_km ?? null,
      nextSlot: nextSlots.get(profileId) ?? null,
      services,
      availability,
      gallery: gallery.map((photo) => photo.url),
      confirmationMode: (row.confirmation_mode ?? 'manual') as ConfirmationMode,
      bookingNoticeMinutes: row.booking_notice_minutes ?? 0,
      cancellationNoticeMinutes: row.cancellation_notice_minutes ?? 0,
      closures: closures.map(({ startsAt, endsAt }) => ({ startsAt, endsAt })),
      onlineBooking,
      instagramUrl: row.instagram_url ?? null,
      facebookUrl: row.facebook_url ?? null,
      tiktokUrl: row.tiktok_url ?? null,
      websiteUrl: row.website_url ?? null,
    };
  }
}
