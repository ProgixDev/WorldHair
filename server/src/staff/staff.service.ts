import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomInt } from 'node:crypto';
import { slices } from '../common/utils/slices';
import { findSalonSubscription } from '../common/utils/subscription-status';
import { SupabaseService } from '../database/supabase.service';
import { AvailabilityDay } from '../salon/salon.service';
import { SubscriptionTier, teamLimitOf } from '../subscriptions/tiers';

/**
 * A salon's team (TODO.md Phase 3): its owner and the coiffeurs who joined
 * with one of his codes, each with their own account (role 'staff'). Every
 * booking holds one of them (appointments.staff_id); the booking rules run
 * per person (appointments/booking-rules.ts). Everyone does every
 * prestation; each person has their own week (inside the salon's hours) and
 * their own congés (coiffeur_time_off.staff_id).
 */

export interface StaffMember {
  id: string;
  profileId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  isOwner: boolean;
  /** Off: clients' bookings never land on them; the owner can still give them one. */
  takesBookings: boolean;
  position: number;
  /** Their own week; `null`: the salon's hours. */
  availability: AvailabilityDay[] | null;
}

export interface SalonInvite {
  code: string;
  expiresAt: string;
  createdAt: string;
}

/** How many people the salon's formula allows, and how many places are left (TODO.md Phase 3). */
export interface TeamCapacity {
  tier: SubscriptionTier;
  /** People working in the salon, its owner included. */
  limit: number;
  members: number;
  /** Codes made and not used yet: each holds a place. */
  openInvites: number;
  free: number;
}

/** What the invite link's page and the join screen show before joining. */
export interface InviteInfo {
  code: string;
  salonName: string;
  expiresAt: string;
}

/** Where a staff account works. */
export interface StaffMembership {
  staffId: string;
  salonId: string;
  salonName: string;
  isOwner: boolean;
}

export interface StaffJoinedEvent {
  salonId: string;
  profileId: string;
  staffId: string;
}

interface StaffRow {
  id: string;
  salon_id: string;
  profile_id: string;
  takes_bookings: boolean;
  position: number;
  created_at: string;
}

interface StaffAvailabilityRow {
  staff_id: string;
  weekday: number;
  is_open: boolean;
  opens_minute: number;
  closes_minute: number;
  break_start_minute: number | null;
  break_end_minute: number | null;
}

interface InviteRow {
  code: string;
  salon_id: string;
  expires_at: string;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

/** No 0/O, 1/I: read out loud or typed from a message without a doubt. */
/** The salon's formula has no place left: the owner moves to Équipe, or frees one. */
const TEAM_FULL = 'TEAM_FULL: your salon\'s formula has no place left';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const INVITE_DAYS = 7;
const DAY_MS = 86_400_000;
const ACTIVE_STATUSES = ['awaiting_payment', 'pending', 'confirmed'];

function newCode(): string {
  return Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}

function mapDay(row: StaffAvailabilityRow): AvailabilityDay {
  return {
    weekday: row.weekday,
    isOpen: row.is_open,
    opensMinute: row.opens_minute,
    closesMinute: row.closes_minute,
    breakStartMinute: row.break_start_minute,
    breakEndMinute: row.break_end_minute,
  };
}

function mapInvite(row: InviteRow): SalonInvite {
  return { code: row.code, expiresAt: row.expires_at, createdAt: row.created_at };
}

@Injectable()
export class StaffService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly events: EventEmitter2,
  ) {}

  // ─── The team ────────────────────────────────────────────────────────────

  /** The salon's team in order, its owner first-made when it has none yet. */
  async team(salonId: string): Promise<StaffMember[]> {
    return (await this.teamsFor([salonId])).get(salonId) ?? [];
  }

  /** Several salons' teams in a few queries (search's next free slots). */
  async teamsFor(salonIds: string[]): Promise<Map<string, StaffMember[]>> {
    let rows = await this.rowsOf(salonIds);
    const withOwner = new Set(rows.filter((row) => row.profile_id === row.salon_id).map((row) => row.salon_id));
    const missing = salonIds.filter((id) => !withOwner.has(id));
    if (missing.length > 0) {
      await this.addOwners(missing);
      rows = await this.rowsOf(salonIds);
    }

    const ids = rows.map((row) => row.id);
    const profileIds = [...new Set(rows.map((row) => row.profile_id))];
    const [weeks, names, ownerNames] = await Promise.all([
      this.weeksOf(ids),
      this.namesOf(profileIds),
      this.applicationNamesOf(rows.filter((row) => row.profile_id === row.salon_id).map((row) => row.salon_id)),
    ]);

    const teams = new Map<string, StaffMember[]>(salonIds.map((id) => [id, []]));
    for (const row of rows) {
      const isOwner = row.profile_id === row.salon_id;
      // A salon's owner signed up through his dossier: his name is there when his profile has none.
      const name = names.get(row.profile_id);
      const fallback = isOwner ? ownerNames.get(row.salon_id) : undefined;
      teams.get(row.salon_id)?.push({
        id: row.id,
        profileId: row.profile_id,
        firstName: name?.firstName || fallback?.firstName || '',
        lastName: name?.lastName || fallback?.lastName || '',
        photoUrl: name?.photoUrl ?? null,
        isOwner,
        takesBookings: row.takes_bookings,
        position: row.position,
        availability: weeks.get(row.id) ?? null,
      });
    }
    for (const team of teams.values()) {
      // The owner first, then in the order they joined.
      team.sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a.position - b.position);
    }
    return teams;
  }

  /** One member of this salon's team — or not found, whoever's they are. */
  async member(salonId: string, staffId: string): Promise<StaffMember> {
    const member = (await this.team(salonId)).find((candidate) => candidate.id === staffId);
    if (!member) {
      throw new NotFoundException('Staff member not found');
    }
    return member;
  }

  /** Where this account works, if anywhere: a staff member's salon, or an owner's own (once his team exists). */
  async membershipOf(profileId: string): Promise<StaffMembership | null> {
    const row = await this.rowOfProfile(profileId);
    if (!row) return null;
    return {
      staffId: row.id,
      salonId: row.salon_id,
      salonName: await this.salonNameOf(row.salon_id),
      isOwner: row.profile_id === row.salon_id,
    };
  }

  async setTakesBookings(salonId: string, staffId: string, takesBookings: boolean): Promise<StaffMember> {
    await this.member(salonId, staffId);
    const { error } = await this.supabase.client
      .from('salon_staff')
      .update({ takes_bookings: takesBookings })
      .eq('id', staffId)
      .eq('salon_id', salonId);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return this.member(salonId, staffId);
  }

  /** A person's own week — `null` gives them back the salon's hours. */
  async replaceHours(salonId: string, staffId: string, days: AvailabilityDay[] | null): Promise<StaffMember> {
    // The whole week or nothing: a partial one would leave days unknown, and is checked before the old one goes.
    if (days && (days.length !== 7 || new Set(days.map((day) => day.weekday)).size !== 7)) {
      throw new BadRequestException('A week is its seven days, each once');
    }
    await this.member(salonId, staffId);
    const { error: clearError } = await this.supabase.client.from('staff_availability').delete().eq('staff_id', staffId);
    if (clearError) {
      throw new InternalServerErrorException(clearError.message);
    }
    if (days) {
      const { error } = await this.supabase.client.from('staff_availability').insert(
        days.map((day) => ({
          staff_id: staffId,
          weekday: day.weekday,
          is_open: day.isOpen,
          opens_minute: day.opensMinute,
          closes_minute: day.closesMinute,
          break_start_minute: day.breakStartMinute ?? null,
          break_end_minute: day.breakEndMinute ?? null,
        })),
      );
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
    }
    return this.member(salonId, staffId);
  }

  /** Out of the team — never the owner, never with bookings to come (the owner reassigns them first). */
  async remove(salonId: string, staffId: string): Promise<void> {
    const member = await this.member(salonId, staffId);
    if (member.isOwner) {
      throw new BadRequestException("A salon's owner can't be removed from its team");
    }
    await this.assertNothingToCome(staffId, 'STAFF_HAS_BOOKINGS: reassign or cancel their bookings to come first');
    await this.deleteRow(staffId);
  }

  /** A staff member leaving the salon — once nothing is booked on them. */
  async leave(profileId: string): Promise<void> {
    const row = await this.rowOfProfile(profileId);
    if (!row) {
      throw new NotFoundException('Not in a salon');
    }
    if (row.profile_id === row.salon_id) {
      throw new BadRequestException("A salon's owner can't leave it");
    }
    await this.assertNothingToCome(row.id, 'STAFF_HAS_BOOKINGS: the salon has to reassign your bookings to come first');
    await this.deleteRow(row.id);
  }

  /**
   * The formula's team size against who's in the team and the codes still
   * open. A salon that dropped from Équipe to Solo keeps its people (`free`
   * is 0, never negative) but takes nobody new.
   */
  async capacity(salonId: string): Promise<TeamCapacity> {
    const [row, members, invites] = await Promise.all([
      findSalonSubscription(this.supabase, salonId),
      this.team(salonId),
      this.listInvites(salonId),
    ]);
    const limit = teamLimitOf(row);
    return {
      tier: row?.tier ?? 'solo',
      limit,
      members: members.length,
      openInvites: invites.length,
      free: Math.max(0, limit - members.length - invites.length),
    };
  }

  /** Bookings still to come on this person, held or accepted — one in progress included. */
  async upcomingCount(staffId: string): Promise<number> {
    const now = Date.now();
    const { data, error } = await this.supabase.client
      .from('appointments')
      .select('id, starts_at, duration_min')
      .eq('staff_id', staffId)
      .in('status', ACTIVE_STATUSES)
      // A booking fits in a day: none that started earlier still runs.
      .gte('starts_at', new Date(now - DAY_MS).toISOString());
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data as { starts_at: string; duration_min: number }[]).filter(
      (row) => new Date(row.starts_at).getTime() + row.duration_min * 60_000 > now,
    ).length;
  }

  // ─── Invites ─────────────────────────────────────────────────────────────

  async createInvite(salonId: string): Promise<SalonInvite> {
    // A team joins a salon WorldHair has validated: not a dossier still under review.
    const { data: application, error: applicationError } = await this.supabase.client
      .from('coiffeur_applications')
      .select('status')
      .eq('profile_id', salonId)
      .maybeSingle();
    if (applicationError) {
      throw new InternalServerErrorException(applicationError.message);
    }
    if ((application as { status: string } | null)?.status !== 'validated') {
      throw new ForbiddenException('Your salon has to be validated before it takes a team');
    }
    await this.team(salonId);
    // The formula's places: a code holds one until it's used, expires or is cancelled.
    if ((await this.capacity(salonId)).free <= 0) {
      throw new ConflictException(TEAM_FULL);
    }
    // A code already taken (one chance in a billion) gets another.
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await this.supabase.client
        .from('salon_invites')
        .insert({
          code: newCode(),
          salon_id: salonId,
          expires_at: new Date(Date.now() + INVITE_DAYS * DAY_MS).toISOString(),
        })
        .select()
        .single();
      if (!error) return mapInvite(data as InviteRow);
      if (error.code !== '23505') {
        throw new InternalServerErrorException(error.message);
      }
    }
    throw new InternalServerErrorException('Could not make an invite code');
  }

  /** Codes still usable: not used, not expired. */
  async listInvites(salonId: string): Promise<SalonInvite[]> {
    const { data, error } = await this.supabase.client
      .from('salon_invites')
      .select()
      .eq('salon_id', salonId)
      .is('used_at', null)
      .gte('expires_at', new Date(Date.now()).toISOString())
      .order('created_at', { ascending: false });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data as InviteRow[]).map(mapInvite);
  }

  /**
   * Which salon a code joins — for the link the owner shares (website page,
   * and the app's « Rejoindre un salon »), signed in or not. Only a code
   * still usable: unknown, used and expired ones read alike.
   */
  async inviteInfo(rawCode: string): Promise<InviteInfo> {
    const code = rawCode.trim().toUpperCase();
    const { data, error } = await this.supabase.client
      .from('salon_invites')
      .select()
      .eq('code', code)
      .is('used_at', null)
      .gte('expires_at', new Date(Date.now()).toISOString())
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    const invite = data as InviteRow | null;
    if (!invite) {
      throw new NotFoundException('INVALID_CODE: this code is unknown, used or expired');
    }
    return { code: invite.code, salonName: await this.salonNameOf(invite.salon_id), expiresAt: invite.expires_at };
  }

  async revokeInvite(salonId: string, code: string): Promise<void> {
    const { error } = await this.supabase.client.from('salon_invites').delete().eq('code', code).eq('salon_id', salonId);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * « Rejoindre un salon »: a code from the owner makes this account one of
   * his team (role 'staff'). No dossier and no admin validation — the owner
   * vouches for them. A client account can join; an owner or an admin can't.
   */
  async join(profileId: string, rawCode: string): Promise<StaffMembership> {
    const code = rawCode.trim().toUpperCase();
    const role = await this.roleOf(profileId);
    if (role !== 'particulier' && role !== 'staff') {
      throw new ConflictException('ALREADY_IN_SALON: this account runs its own salon');
    }
    if (await this.rowOfProfile(profileId)) {
      throw new ConflictException('ALREADY_IN_SALON: leave your current salon first');
    }

    const now = new Date(Date.now()).toISOString();
    // Claimed in one write, still valid: two people typing the same code, only one gets in.
    const { data: claimed, error: claimError } = await this.supabase.client
      .from('salon_invites')
      .update({ used_by: profileId, used_at: now })
      .eq('code', code)
      .is('used_at', null)
      .gte('expires_at', now)
      .select()
      .maybeSingle();
    if (claimError) {
      throw new InternalServerErrorException(claimError.message);
    }
    const invite = claimed as InviteRow | null;
    if (!invite) {
      throw new NotFoundException('INVALID_CODE: this code is unknown, used or expired');
    }

    // No transactions through PostgREST: a step failing below undoes the ones before, the code given back unused.
    let joined: StaffRow | null = null;
    try {
      joined = await this.addMember(invite.salon_id, profileId);
      const { error: roleError } = await this.supabase.client
        .from('profiles')
        .update({ role: 'staff' })
        .eq('id', profileId)
        .select()
        .maybeSingle();
      if (roleError) {
        throw new InternalServerErrorException(roleError.message);
      }
    } catch (err) {
      if (joined) await this.supabase.client.from('salon_staff').delete().eq('id', joined.id);
      await this.supabase.client.from('salon_invites').update({ used_by: null, used_at: null }).eq('code', code);
      throw err;
    }
    const row = joined;

    this.events.emit('staff.joined', { salonId: row.salon_id, profileId, staffId: row.id } satisfies StaffJoinedEvent);
    return { staffId: row.id, salonId: row.salon_id, salonName: await this.salonNameOf(row.salon_id), isOwner: false };
  }

  private async addMember(salonId: string, profileId: string): Promise<StaffRow> {
    const team = await this.team(salonId);
    // Checked again here: the salon may have dropped to Solo since it made the code. This code is the claimed one, no longer open.
    if (team.length >= teamLimitOf(await findSalonSubscription(this.supabase, salonId))) {
      throw new ConflictException(TEAM_FULL);
    }
    const { data, error } = await this.supabase.client
      .from('salon_staff')
      .insert({
        salon_id: salonId,
        profile_id: profileId,
        position: Math.max(0, ...team.map((member) => member.position)) + 1,
      })
      .select()
      .single();
    if (error) {
      throw error.code === '23505'
        ? new ConflictException('ALREADY_IN_SALON: leave your current salon first')
        : new InternalServerErrorException(error.message);
    }
    return data as StaffRow;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async assertNothingToCome(staffId: string, message: string): Promise<void> {
    if ((await this.upcomingCount(staffId)) > 0) {
      throw new ConflictException(message);
    }
  }

  private async deleteRow(staffId: string): Promise<void> {
    const { error } = await this.supabase.client.from('salon_staff').delete().eq('id', staffId);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  private async rowsOf(salonIds: string[]): Promise<StaffRow[]> {
    const rows: StaffRow[] = [];
    for (const slice of slices(salonIds)) {
      const { data, error } = await this.supabase.client.from('salon_staff').select().in('salon_id', slice);
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
      rows.push(...(data as StaffRow[]));
    }
    return rows.sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
  }

  private async rowOfProfile(profileId: string): Promise<StaffRow | null> {
    const { data, error } = await this.supabase.client.from('salon_staff').select().eq('profile_id', profileId).maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data as StaffRow | null;
  }

  /** Each salon's owner as its first member — a race with another request making it is fine. */
  private async addOwners(salonIds: string[]): Promise<void> {
    for (const salonId of salonIds) {
      const { error } = await this.supabase.client
        .from('salon_staff')
        .insert({ salon_id: salonId, profile_id: salonId, position: 0 });
      if (error && error.code !== '23505') {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  private async weeksOf(staffIds: string[]): Promise<Map<string, AvailabilityDay[]>> {
    const weeks = new Map<string, AvailabilityDay[]>();
    for (const slice of slices(staffIds)) {
      const { data, error } = await this.supabase.client.from('staff_availability').select().in('staff_id', slice);
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
      for (const row of data as StaffAvailabilityRow[]) {
        weeks.set(row.staff_id, [...(weeks.get(row.staff_id) ?? []), mapDay(row)]);
      }
    }
    for (const days of weeks.values()) days.sort((a, b) => a.weekday - b.weekday);
    return weeks;
  }

  private async namesOf(
    profileIds: string[],
  ): Promise<Map<string, { firstName: string; lastName: string; photoUrl: string | null }>> {
    const names = new Map<string, { firstName: string; lastName: string; photoUrl: string | null }>();
    for (const slice of slices(profileIds)) {
      const { data, error } = await this.supabase.client
        .from('profiles')
        .select('id, first_name, last_name, photo_url')
        .in('id', slice);
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
      for (const row of data as { id: string; first_name: string; last_name: string; photo_url: string | null }[]) {
        names.set(row.id, { firstName: row.first_name, lastName: row.last_name, photoUrl: row.photo_url });
      }
    }
    return names;
  }

  private async applicationNamesOf(profileIds: string[]): Promise<Map<string, { firstName: string; lastName: string }>> {
    const names = new Map<string, { firstName: string; lastName: string }>();
    for (const slice of slices(profileIds)) {
      const { data, error } = await this.supabase.client
        .from('coiffeur_applications')
        .select('profile_id, first_name, last_name')
        .in('profile_id', slice);
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
      for (const row of data as { profile_id: string; first_name: string; last_name: string }[]) {
        names.set(row.profile_id, { firstName: row.first_name, lastName: row.last_name });
      }
    }
    return names;
  }

  private async salonNameOf(salonId: string): Promise<string> {
    const { data, error } = await this.supabase.client
      .from('coiffeur_profiles')
      .select('salon_name')
      .eq('profile_id', salonId)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data as { salon_name: string } | null)?.salon_name ?? '';
  }

  private async roleOf(profileId: string): Promise<string | null> {
    const { data, error } = await this.supabase.client.from('profiles').select('role').eq('id', profileId).maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data as { role: string } | null)?.role ?? null;
  }
}
