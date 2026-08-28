import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { AvailabilityDayDto } from './dto/availability-day.dto';
import { Specialty } from './dto/update-salon-profile.dto';

export interface SalonProfile {
  salonName: string;
  tagline: string;
  description: string;
  addressLine: string;
  postalCode: string;
  city: string;
  phone: string;
  specialties: Specialty[];
  coverUrl: string | null;
}

const EMPTY_PROFILE: SalonProfile = {
  salonName: '',
  tagline: '',
  description: '',
  addressLine: '',
  postalCode: '',
  city: '',
  phone: '',
  specialties: [],
  coverUrl: null,
};

export interface AvailabilityDay {
  weekday: number;
  isOpen: boolean;
  opensMinute: number;
  closesMinute: number;
  breakStartMinute: number | null;
  breakEndMinute: number | null;
}

/** A brand-new coiffeur's calendar before they've ever saved their own hours — Mon-Sat, 9-19, lunch break, Sunday closed. */
function defaultAvailability(): AvailabilityDay[] {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    isOpen: weekday !== 0,
    opensMinute: 9 * 60,
    closesMinute: 19 * 60,
    breakStartMinute: weekday === 0 ? null : 13 * 60,
    breakEndMinute: weekday === 0 ? null : 14 * 60,
  }));
}

export interface SalonServiceItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMin: number;
  specialty: Specialty;
}

export interface UpdateServiceInput {
  name?: string;
  description?: string;
  price?: number;
  durationMin?: number;
  specialty?: Specialty;
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
}

interface AvailabilityRow {
  weekday: number;
  is_open: boolean;
  opens_minute: number;
  closes_minute: number;
  break_start_minute: number | null;
  break_end_minute: number | null;
}

interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  duration_min: number;
  specialty: string;
}

function mapProfile(row: ProfileRow): SalonProfile {
  return {
    salonName: row.salon_name,
    tagline: row.tagline,
    description: row.description,
    addressLine: row.address_line,
    postalCode: row.postal_code,
    city: row.city,
    phone: row.phone,
    specialties: row.specialties as Specialty[],
    coverUrl: row.cover_url,
  };
}

function mapAvailability(row: AvailabilityRow): AvailabilityDay {
  return {
    weekday: row.weekday,
    isOpen: row.is_open,
    opensMinute: row.opens_minute,
    closesMinute: row.closes_minute,
    breakStartMinute: row.break_start_minute,
    breakEndMinute: row.break_end_minute,
  };
}

function mapService(row: ServiceRow): SalonServiceItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    // Postgres numeric columns come back through PostgREST as strings.
    price: Number(row.price),
    durationMin: row.duration_min,
    specialty: row.specialty as Specialty,
  };
}

/**
 * The coiffeur's ongoing "Mon salon" workspace: presentation page, weekly
 * hours, and prestations (see `../../schema.sql`'s coiffeur_profiles/
 * coiffeur_availability/coiffeur_services). Distinct from
 * `CoiffeurApplicationsService` — that's the one-time onboarding record.
 */
@Injectable()
export class SalonService {
  constructor(private readonly supabase: SupabaseService) {}

  // ─── Profile ────────────────────────────────────────────────────────────

  async getProfile(userId: string): Promise<SalonProfile> {
    const { data, error } = await this.supabase.client
      .from('coiffeur_profiles')
      .select()
      .eq('profile_id', userId)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data ? mapProfile(data as ProfileRow) : EMPTY_PROFILE;
  }

  async updateProfile(userId: string, patch: Partial<SalonProfile>): Promise<SalonProfile> {
    const row: Record<string, unknown> = { profile_id: userId };
    if (patch.salonName !== undefined) row.salon_name = patch.salonName;
    if (patch.tagline !== undefined) row.tagline = patch.tagline;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.addressLine !== undefined) row.address_line = patch.addressLine;
    if (patch.postalCode !== undefined) row.postal_code = patch.postalCode;
    if (patch.city !== undefined) row.city = patch.city;
    if (patch.phone !== undefined) row.phone = patch.phone;
    if (patch.specialties !== undefined) row.specialties = patch.specialties;
    if (patch.coverUrl !== undefined) row.cover_url = patch.coverUrl;

    const { data, error } = await this.supabase.client
      .from('coiffeur_profiles')
      .upsert(row, { onConflict: 'profile_id' })
      .select()
      .single();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return mapProfile(data as ProfileRow);
  }

  // ─── Availability ───────────────────────────────────────────────────────

  async getAvailability(userId: string): Promise<AvailabilityDay[]> {
    const { data, error } = await this.supabase.client
      .from('coiffeur_availability')
      .select()
      .eq('profile_id', userId)
      .order('weekday', { ascending: true });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    const rows = data as AvailabilityRow[];
    return rows.length > 0 ? rows.map(mapAvailability) : defaultAvailability();
  }

  async replaceAvailability(userId: string, days: AvailabilityDayDto[]): Promise<AvailabilityDay[]> {
    const rows = days.map((day) => ({
      profile_id: userId,
      weekday: day.weekday,
      is_open: day.isOpen,
      opens_minute: day.opensMinute,
      closes_minute: day.closesMinute,
      break_start_minute: day.breakStartMinute ?? null,
      break_end_minute: day.breakEndMinute ?? null,
    }));

    const { data, error } = await this.supabase.client
      .from('coiffeur_availability')
      .upsert(rows, { onConflict: 'profile_id,weekday' })
      .select()
      .order('weekday', { ascending: true });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data as AvailabilityRow[]).map(mapAvailability);
  }

  // ─── Services (prestations) ─────────────────────────────────────────────

  async listServices(userId: string): Promise<SalonServiceItem[]> {
    const { data, error } = await this.supabase.client
      .from('coiffeur_services')
      .select()
      .eq('profile_id', userId)
      .order('created_at', { ascending: true });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data as ServiceRow[]).map(mapService);
  }

  async createService(
    userId: string,
    input: { name: string; description?: string; price: number; durationMin: number; specialty: Specialty },
  ): Promise<SalonServiceItem> {
    const { data, error } = await this.supabase.client
      .from('coiffeur_services')
      .insert({
        profile_id: userId,
        name: input.name,
        description: input.description ?? null,
        price: input.price,
        duration_min: input.durationMin,
        specialty: input.specialty,
      })
      .select()
      .single();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return mapService(data as ServiceRow);
  }

  async updateService(userId: string, serviceId: string, patch: UpdateServiceInput): Promise<SalonServiceItem> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.price !== undefined) row.price = patch.price;
    if (patch.durationMin !== undefined) row.duration_min = patch.durationMin;
    if (patch.specialty !== undefined) row.specialty = patch.specialty;

    const { data, error } = await this.supabase.client
      .from('coiffeur_services')
      .update(row)
      // Both filters, not just RLS: a stray id from another coiffeur 404s
      // instead of silently no-op'ing on a row this update was never
      // supposed to touch in the first place.
      .eq('id', serviceId)
      .eq('profile_id', userId)
      .select()
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException('Service not found');
    }
    return mapService(data as ServiceRow);
  }

  async deleteService(userId: string, serviceId: string): Promise<void> {
    const { error, count } = await this.supabase.client
      .from('coiffeur_services')
      .delete({ count: 'exact' })
      .eq('id', serviceId)
      .eq('profile_id', userId);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!count) {
      throw new NotFoundException('Service not found');
    }
  }
}
