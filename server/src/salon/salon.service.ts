import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { slices } from '../common/utils/slices';
import { SupabaseService } from '../database/supabase.service';
import { AvailabilityDayDto } from './dto/availability-day.dto';
import { AddGalleryPhotoDto } from './dto/gallery-photo.dto';
import { ConfirmationMode, Specialty } from './dto/update-salon-profile.dto';

/** Horizontal strip on the salon page — a handful of curated shots, not an unbounded album. */
const GALLERY_MAX_PHOTOS = 12;

export interface SalonProfile {
  salonName: string;
  tagline: string;
  description: string;
  addressLine: string;
  postalCode: string;
  city: string;
  phone: string;
  /** ISO 3166-1 alpha-2 the coiffeur picked for `phone` — see schema.sql's coiffeur_profiles.phone_country. */
  phoneCountry: string | null;
  specialties: Specialty[];
  coverUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  /** `instant`: a new booking is confirmed straight away; `manual`: the coiffeur accepts or refuses it. */
  confirmationMode: ConfirmationMode;
  /** How late before its start a client can still book (0 = up to the start). */
  bookingNoticeMinutes: number;
  /** How late before its start a client can still cancel or move an accepted booking (0 = anytime). */
  cancellationNoticeMinutes: number;
  /** In a salon, or at the client's home within `travelRadiusKm` — from the application (TODO.md Phase 6). */
  practiceZone: PracticeZone;
  travelRadiusKm: number | null;
  /** The salon's pages elsewhere, shown as icons on its public page. */
  instagramUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
  websiteUrl: string | null;
  /** As clients see it: hidden reviews left out (refresh_salon_rating in schema.sql). Read-only here. */
  rating: number;
  reviewCount: number;
}

export type PracticeZone = 'salon' | 'domicile';

/** What the coiffeur can change from "Mon salon"; the rest comes from the application or the reviews. */
export type SalonProfilePatch = Partial<Omit<SalonProfile, 'practiceZone' | 'travelRadiusKm' | 'rating' | 'reviewCount'>>;

/** Same defaults as schema.sql's coiffeur_profiles columns. */
const EMPTY_PROFILE: SalonProfile = {
  salonName: '',
  tagline: '',
  description: '',
  addressLine: '',
  postalCode: '',
  city: '',
  phone: '',
  phoneCountry: null,
  specialties: [],
  coverUrl: null,
  latitude: null,
  longitude: null,
  confirmationMode: 'manual',
  bookingNoticeMinutes: 60,
  cancellationNoticeMinutes: 1440,
  practiceZone: 'salon',
  travelRadiusKm: null,
  instagramUrl: null,
  facebookUrl: null,
  tiktokUrl: null,
  websiteUrl: null,
  rating: 0,
  reviewCount: 0,
};

/** A congé or exceptional closure: whole days, or a few hours of one day. */
export interface TimeOff {
  id: string;
  startsAt: string;
  endsAt: string;
  label: string;
}

/** An active booking that falls inside a closure the coiffeur just added — listed so they can move or cancel it. */
export interface TimeOffConflict {
  appointmentId: string;
  startsAt: string;
  durationMin: number;
  serviceName: string;
  status: string;
}

interface TimeOffRow {
  id: string;
  profile_id: string;
  starts_at: string;
  ends_at: string;
  label: string;
}

function mapTimeOff(row: TimeOffRow): TimeOff {
  return { id: row.id, startsAt: row.starts_at, endsAt: row.ends_at, label: row.label };
}

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
  /** Shown to clients and bookable; a hidden one stays in the coiffeur's list only. */
  isActive: boolean;
}

export interface UpdateServiceInput {
  name?: string;
  description?: string;
  price?: number;
  durationMin?: number;
  specialty?: Specialty;
  isActive?: boolean;
}

interface ProfileRow {
  salon_name: string;
  tagline: string;
  description: string;
  address_line: string;
  postal_code: string;
  city: string;
  phone: string;
  phone_country: string | null;
  specialties: string[];
  cover_url: string | null;
  latitude: number | null;
  longitude: number | null;
  confirmation_mode: string;
  booking_notice_minutes: number;
  cancellation_notice_minutes: number;
  practice_zone?: string | null;
  travel_radius_km?: number | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  tiktok_url?: string | null;
  website_url?: string | null;
  rating?: number | string | null;
  review_count?: number | null;
}

interface AvailabilityRow {
  profile_id?: string;
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
  is_active?: boolean | null;
}

export interface SalonGalleryPhoto {
  id: string;
  url: string;
  storagePath: string;
}

interface GalleryPhotoRow {
  id: string;
  profile_id: string;
  url: string;
  storage_path: string;
  created_at: string;
}

function mapGalleryPhoto(row: GalleryPhotoRow): SalonGalleryPhoto {
  return { id: row.id, url: row.url, storagePath: row.storage_path };
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
    phoneCountry: row.phone_country ?? null,
    specialties: row.specialties as Specialty[],
    coverUrl: row.cover_url,
    latitude: row.latitude,
    longitude: row.longitude,
    confirmationMode: row.confirmation_mode as ConfirmationMode,
    bookingNoticeMinutes: row.booking_notice_minutes,
    cancellationNoticeMinutes: row.cancellation_notice_minutes,
    practiceZone: (row.practice_zone ?? 'salon') as PracticeZone,
    travelRadiusKm: row.travel_radius_km ?? null,
    instagramUrl: row.instagram_url ?? null,
    facebookUrl: row.facebook_url ?? null,
    tiktokUrl: row.tiktok_url ?? null,
    websiteUrl: row.website_url ?? null,
    rating: Number(row.rating ?? 0),
    reviewCount: row.review_count ?? 0,
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
    isActive: row.is_active !== false,
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

  /**
   * Pre-fills "Mon salon" with what the coiffeur already typed during
   * signup (salonName/description/phone/address — see
   * SubmitCoiffeurApplicationDto) the moment their application is validated,
   * so the editor doesn't start blank even though it reads a completely
   * separate table (coiffeur_applications is the one-time KYC snapshot;
   * this is the ongoing, particulier-facing profile). `ignoreDuplicates`
   * makes this a true no-op if a row already exists — e.g. a re-validation
   * after the coiffeur has already customized their profile must never
   * clobber it.
   */
  async seedProfileFromApplication(
    userId: string,
    application: {
      salonName: string;
      description: string;
      phone: string;
      addressLine: string | null;
      postalCode: string | null;
      city: string | null;
      /** How they work, from the application: search filters on it (TODO.md Phase 6). */
      practiceZone?: PracticeZone;
      travelRadiusKm?: number | null;
    },
  ): Promise<void> {
    // No `.select()` chained: with `ignoreDuplicates`, PostgREST returns no
    // row at all when an existing one was skipped — chaining `.single()`
    // would then throw on the exact "already seeded" case this is meant to
    // handle silently.
    const { error } = await this.supabase.client.from('coiffeur_profiles').upsert(
      {
        profile_id: userId,
        salon_name: application.salonName,
        description: application.description,
        phone: application.phone,
        address_line: application.addressLine ?? '',
        postal_code: application.postalCode ?? '',
        city: application.city ?? '',
        practice_zone: application.practiceZone ?? 'salon',
        travel_radius_km: application.practiceZone === 'domicile' ? (application.travelRadiusKm ?? null) : null,
      },
      { onConflict: 'profile_id', ignoreDuplicates: true },
    );
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async updateProfile(userId: string, patch: SalonProfilePatch): Promise<SalonProfile> {
    const row: Record<string, unknown> = { profile_id: userId };
    if (patch.salonName !== undefined) row.salon_name = patch.salonName;
    if (patch.tagline !== undefined) row.tagline = patch.tagline;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.addressLine !== undefined) row.address_line = patch.addressLine;
    if (patch.postalCode !== undefined) row.postal_code = patch.postalCode;
    if (patch.city !== undefined) row.city = patch.city;
    if (patch.phone !== undefined) row.phone = patch.phone;
    if (patch.phoneCountry !== undefined) row.phone_country = patch.phoneCountry;
    if (patch.specialties !== undefined) row.specialties = patch.specialties;
    if (patch.coverUrl !== undefined) row.cover_url = patch.coverUrl;
    if (patch.latitude !== undefined) row.latitude = patch.latitude;
    if (patch.longitude !== undefined) row.longitude = patch.longitude;
    if (patch.confirmationMode !== undefined) row.confirmation_mode = patch.confirmationMode;
    if (patch.bookingNoticeMinutes !== undefined) row.booking_notice_minutes = patch.bookingNoticeMinutes;
    if (patch.cancellationNoticeMinutes !== undefined) row.cancellation_notice_minutes = patch.cancellationNoticeMinutes;
    if (patch.instagramUrl !== undefined) row.instagram_url = patch.instagramUrl || null;
    if (patch.facebookUrl !== undefined) row.facebook_url = patch.facebookUrl || null;
    if (patch.tiktokUrl !== undefined) row.tiktok_url = patch.tiktokUrl || null;
    if (patch.websiteUrl !== undefined) row.website_url = patch.websiteUrl || null;

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

  /** Several salons' weeks in a few queries (search's next free slots) — the default for one never saved. */
  async availabilityFor(userIds: string[]): Promise<Map<string, AvailabilityDay[]>> {
    const byProfile = new Map<string, AvailabilityDay[]>(userIds.map((id) => [id, []]));
    for (const slice of slices(userIds)) {
      const { data, error } = await this.supabase.client.from('coiffeur_availability').select().in('profile_id', slice);
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
      for (const row of data as AvailabilityRow[]) byProfile.get(row.profile_id!)?.push(mapAvailability(row));
    }
    for (const [id, days] of byProfile) {
      byProfile.set(id, days.length > 0 ? days.sort((a, b) => a.weekday - b.weekday) : defaultAvailability());
    }
    return byProfile;
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

  /** Every service for the coiffeur's own editor; `activeOnly` for what clients see and book. */
  async listServices(userId: string, options: { activeOnly?: boolean } = {}): Promise<SalonServiceItem[]> {
    let query = this.supabase.client.from('coiffeur_services').select().eq('profile_id', userId);
    if (options.activeOnly) query = query.eq('is_active', true);
    const { data, error } = await query.order('created_at', { ascending: true });
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
    if (patch.isActive !== undefined) row.is_active = patch.isActive;

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

  // ─── Gallery ("Réalisations") ────────────────────────────────────────────

  async listGalleryPhotos(userId: string): Promise<SalonGalleryPhoto[]> {
    const { data, error } = await this.supabase.client
      .from('coiffeur_gallery_photos')
      .select()
      .eq('profile_id', userId)
      .order('created_at', { ascending: true });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data as GalleryPhotoRow[]).map(mapGalleryPhoto);
  }

  async addGalleryPhoto(userId: string, dto: AddGalleryPhotoDto): Promise<SalonGalleryPhoto[]> {
    const existing = await this.listGalleryPhotos(userId);
    if (existing.length >= GALLERY_MAX_PHOTOS) {
      throw new BadRequestException(`${GALLERY_MAX_PHOTOS} photos maximum.`);
    }

    const { error } = await this.supabase.client
      .from('coiffeur_gallery_photos')
      .insert({
        profile_id: userId,
        url: dto.url,
        storage_path: dto.storagePath,
      })
      .select()
      .single();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return this.listGalleryPhotos(userId);
  }

  async deleteGalleryPhoto(userId: string, photoId: string): Promise<SalonGalleryPhoto[]> {
    const { error, count } = await this.supabase.client
      .from('coiffeur_gallery_photos')
      .delete({ count: 'exact' })
      .eq('id', photoId)
      .eq('profile_id', userId);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!count) {
      throw new NotFoundException('Photo not found');
    }
    return this.listGalleryPhotos(userId);
  }

  // ─── Closures (congés, fermetures exceptionnelles) ───────────────────────

  /** Several salons' closures not over yet at `from`, in a few queries (search's next free slots). */
  async timeOffFor(userIds: string[], from: Date): Promise<Map<string, TimeOff[]>> {
    const byProfile = new Map<string, TimeOff[]>(userIds.map((id) => [id, []]));
    for (const slice of slices(userIds)) {
      const { data, error } = await this.supabase.client
        .from('coiffeur_time_off')
        .select()
        .in('profile_id', slice)
        .gte('ends_at', from.toISOString());
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
      for (const row of data as TimeOffRow[]) byProfile.get(row.profile_id)?.push(mapTimeOff(row));
    }
    return byProfile;
  }

  /** Closures not over yet at `from` (now by default), soonest first. Also read by booking and the public salon page. */
  async listTimeOff(userId: string, from: Date = new Date()): Promise<TimeOff[]> {
    const { data, error } = await this.supabase.client
      .from('coiffeur_time_off')
      .select()
      .eq('profile_id', userId)
      .gte('ends_at', from.toISOString())
      .order('starts_at', { ascending: true });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data as TimeOffRow[])
      .map(mapTimeOff)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }

  /**
   * Adds a closure. Bookings already inside it are NOT cancelled: they come
   * back as `conflicts` so the coiffeur decides, booking by booking, whether
   * to move or cancel them (and the client is notified either way).
   */
  async addTimeOff(
    userId: string,
    input: { startsAt: string; endsAt: string; label?: string },
  ): Promise<{ timeOff: TimeOff; conflicts: TimeOffConflict[] }> {
    const startsMs = new Date(input.startsAt).getTime();
    const endsMs = new Date(input.endsAt).getTime();
    if (Number.isNaN(startsMs) || Number.isNaN(endsMs) || endsMs <= startsMs) {
      throw new BadRequestException('A closure must end after it starts');
    }
    if (endsMs <= Date.now()) {
      throw new BadRequestException('This closure is already over');
    }

    const { data, error } = await this.supabase.client
      .from('coiffeur_time_off')
      .insert({
        profile_id: userId,
        starts_at: new Date(startsMs).toISOString(),
        ends_at: new Date(endsMs).toISOString(),
        label: input.label?.trim() ?? '',
      })
      .select()
      .single();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const { data: bookings, error: bookingsError } = await this.supabase.client
      .from('appointments')
      .select()
      .eq('coiffeur_id', userId)
      .in('status', ['pending', 'confirmed']);
    if (bookingsError) {
      throw new InternalServerErrorException(bookingsError.message);
    }
    const conflicts = (
      bookings as { id: string; starts_at: string; duration_min: number; service_name: string; status: string }[]
    )
      .filter((booking) => {
        const bookingStart = new Date(booking.starts_at).getTime();
        const bookingEnd = bookingStart + booking.duration_min * 60_000;
        // One already over needs nothing from the coiffeur.
        return bookingStart < endsMs && startsMs < bookingEnd && bookingEnd > Date.now();
      })
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map((booking) => ({
        appointmentId: booking.id,
        startsAt: booking.starts_at,
        durationMin: booking.duration_min,
        serviceName: booking.service_name,
        status: booking.status,
      }));

    return { timeOff: mapTimeOff(data as TimeOffRow), conflicts };
  }

  async deleteTimeOff(userId: string, id: string): Promise<void> {
    const { error, count } = await this.supabase.client
      .from('coiffeur_time_off')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('profile_id', userId);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!count) {
      throw new NotFoundException('Closure not found');
    }
  }
}
