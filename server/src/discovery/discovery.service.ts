import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CoiffeurApplicationsService } from '../coiffeur/coiffeur-applications.service';
import { SupabaseService } from '../database/supabase.service';
import { Specialty } from '../salon/dto/update-salon-profile.dto';
import { AvailabilityDay, SalonService, SalonServiceItem } from '../salon/salon.service';

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
}

export interface SalonDetail extends SalonSummary {
  services: SalonServiceItem[];
  availability: AvailabilityDay[];
}

export interface SalonSearchResult {
  items: SalonSummary[];
  total: number;
}

export interface SearchSalonsParams {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  specialty?: Specialty;
  city?: string;
  query?: string;
  limit: number;
  offset: number;
}

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
}

function mapSearchRow(row: SearchSalonRow): SalonSummary {
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
  ) {}

  async search(params: SearchSalonsParams): Promise<SalonSearchResult> {
    const { data, error } = await this.supabase.client.rpc('search_salons', {
      p_lat: params.lat ?? null,
      p_lng: params.lng ?? null,
      p_radius_km: params.radiusKm ?? null,
      p_specialty: params.specialty ?? null,
      p_city: params.city ?? null,
      p_query: params.query ?? null,
      p_limit: params.limit,
      p_offset: params.offset,
    });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    const rows = data as SearchSalonRow[];
    return { items: rows.map(mapSearchRow), total: rows[0]?.total_count ?? 0 };
  }

  /** Distinct cities among currently-visible salons — feeds the manual-location picker. */
  async listCities(): Promise<string[]> {
    const { items } = await this.search({ limit: 500, offset: 0 });
    const cities = new Set(items.map((item) => item.city).filter((city) => city.length > 0));
    return [...cities].sort();
  }

  async getById(profileId: string): Promise<SalonDetail> {
    const application = await this.applications.getMine(profileId);
    if (!application || application.status !== 'validated' || !application.shopProfileComplete) {
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

    const [services, availability] = await Promise.all([
      this.salon.listServices(profileId),
      this.salon.getAvailability(profileId),
    ]);

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
      services,
      availability,
    };
  }
}
