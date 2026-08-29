import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CoiffeurApplicationsService } from '../coiffeur/coiffeur-applications.service';
import { SupabaseService } from '../database/supabase.service';
import { SalonService } from '../salon/salon.service';

/**
 * "done" is NOT a stored status (see schema.sql's appointments table) — it's
 * derived here, at read time, from "confirmed AND already past". No cron or
 * background job transitions it; nothing in the product ever needs to act on
 * the transition itself, only ever read the resulting label.
 */
export type AppointmentStatus = 'pending' | 'confirmed' | 'refused' | 'cancelled' | 'done';

export interface ParticulierAppointment {
  id: string;
  salonId: string;
  salonName: string;
  serviceId: string | null;
  serviceName: string;
  startsAt: string;
  durationMin: number;
  price: number;
  status: AppointmentStatus;
  createdAt: string;
}

export interface CoiffeurAppointment {
  id: string;
  serviceId: string | null;
  clientId: string;
  clientName: string;
  startsAt: string;
  durationMin: number;
  price: number;
  status: AppointmentStatus;
  note?: string;
  /** First-ever booking from this client at this salon. */
  isNewClient: boolean;
}

export interface CreateAppointmentInput {
  coiffeurId: string;
  serviceId: string;
  startsAt: string;
  note?: string;
}

export interface AppointmentRow {
  id: string;
  particulier_id: string;
  coiffeur_id: string;
  service_id: string | null;
  service_name: string;
  price: string | number;
  duration_min: number;
  starts_at: string;
  status: string;
  client_note: string | null;
  created_at: string;
}

function endTimeMs(row: { starts_at: string; duration_min: number }): number {
  return new Date(row.starts_at).getTime() + row.duration_min * 60000;
}

/** Exported for ReviewsService — a review may only be left once its appointment shows as "done". */
export function derivedStatus(row: AppointmentRow, now: Date = new Date()): AppointmentStatus {
  if (row.status === 'confirmed' && endTimeMs(row) < now.getTime()) return 'done';
  return row.status as AppointmentStatus;
}

function overlaps(aStartMs: number, aEndMs: number, row: AppointmentRow): boolean {
  const bStart = new Date(row.starts_at).getTime();
  const bEnd = bStart + row.duration_min * 60000;
  return aStartMs < bEnd && bStart < aEndMs;
}

/**
 * "Rendez-vous / Agenda" (TODO.md) — the shared booking lifecycle both the
 * particulier and coiffeur sides read/write, just through different lenses
 * (see the two response shapes above). A request starts `pending`; the
 * coiffeur accepts or refuses it; either side can cancel a still-active one.
 */
@Injectable()
export class AppointmentsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly applications: CoiffeurApplicationsService,
    private readonly salon: SalonService,
    private readonly events: EventEmitter2,
  ) {}

  // ─── Create (particulier) ────────────────────────────────────────────────

  async create(particulierId: string, input: CreateAppointmentInput): Promise<ParticulierAppointment> {
    const [application, profile, services] = await Promise.all([
      this.applications.getMine(input.coiffeurId),
      this.salon.getProfile(input.coiffeurId),
      this.salon.listServices(input.coiffeurId),
    ]);
    if (!application || application.status !== 'validated' || !application.shopProfileComplete) {
      throw new NotFoundException('Salon not found');
    }
    const service = services.find((item) => item.id === input.serviceId);
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const startsAt = this.parseFutureDate(input.startsAt);
    await this.assertSlotAvailable(input.coiffeurId, startsAt, service.durationMin);

    const { data, error } = await this.supabase.client
      .from('appointments')
      .insert({
        particulier_id: particulierId,
        coiffeur_id: input.coiffeurId,
        service_id: service.id,
        service_name: service.name,
        price: service.price,
        duration_min: service.durationMin,
        starts_at: startsAt.toISOString(),
        status: 'pending',
        client_note: input.note?.trim() || null,
      })
      .select()
      .single();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    const created = data as AppointmentRow;
    this.events.emit('appointment.created', {
      appointmentId: created.id,
      coiffeurId: input.coiffeurId,
      serviceName: service.name,
      startsAt: created.starts_at,
    });
    return this.mapParticulier(created, profile.salonName);
  }

  // ─── Particulier: list / reschedule / cancel ────────────────────────────

  async listForParticulier(particulierId: string): Promise<ParticulierAppointment[]> {
    const rows = await this.rowsWhere('particulier_id', particulierId);
    const salonNames = await this.salonNamesFor([...new Set(rows.map((row) => row.coiffeur_id))]);
    const now = new Date();
    return rows
      .map((row) => this.mapParticulier(row, salonNames.get(row.coiffeur_id) ?? '', now))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async reschedule(particulierId: string, id: string, startsAtIso: string): Promise<ParticulierAppointment> {
    const row = await this.rowOrThrow(id);
    if (row.particulier_id !== particulierId) {
      throw new ForbiddenException();
    }
    this.assertStillActive(row);

    const startsAt = this.parseFutureDate(startsAtIso);
    await this.assertSlotAvailable(row.coiffeur_id, startsAt, row.duration_min, id);

    const [updated, profile] = await Promise.all([
      this.updateRow(id, { starts_at: startsAt.toISOString() }),
      this.salon.getProfile(row.coiffeur_id),
    ]);
    return this.mapParticulier(updated, profile.salonName);
  }

  async cancel(currentUserId: string, id: string): Promise<void> {
    const row = await this.rowOrThrow(id);
    if (row.particulier_id !== currentUserId && row.coiffeur_id !== currentUserId) {
      throw new ForbiddenException();
    }
    this.assertStillActive(row);
    await this.updateRow(id, { status: 'cancelled' });
    this.events.emit('appointment.cancelled', {
      appointmentId: id,
      coiffeurId: row.coiffeur_id,
      cancelledByUserId: currentUserId,
      serviceName: row.service_name,
      startsAt: row.starts_at,
    });
  }

  // ─── Public: busy slots for the booking-flow slot picker ────────────────

  /**
   * Which starts are already spoken for at this salon — no client identity,
   * safe for any particulier to read (unlike listForCoiffeur). Lets the
   * booking flow grey out a slot someone else already holds, not just the
   * caller's own bookings.
   */
  async listBusySlots(coiffeurId: string): Promise<{ startsAt: string; durationMin: number }[]> {
    const rows = (await this.rowsWhere('coiffeur_id', coiffeurId)).filter(
      (row) => row.status === 'pending' || row.status === 'confirmed',
    );
    return rows.map((row) => ({ startsAt: row.starts_at, durationMin: row.duration_min }));
  }

  // ─── Coiffeur: list / decide ─────────────────────────────────────────────

  async listForCoiffeur(coiffeurId: string): Promise<CoiffeurAppointment[]> {
    const rows = (await this.rowsWhere('coiffeur_id', coiffeurId)).sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
    const names = await this.particulierNamesFor([...new Set(rows.map((row) => row.particulier_id))]);

    const seen = new Set<string>();
    const now = new Date();
    const mapped = rows.map((row) => {
      const isNewClient = !seen.has(row.particulier_id);
      seen.add(row.particulier_id);
      return this.mapCoiffeur(row, names.get(row.particulier_id) ?? 'Client', isNewClient, now);
    });
    return mapped.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async decide(coiffeurId: string, id: string, decision: 'confirmed' | 'refused'): Promise<void> {
    const row = await this.rowOrThrow(id);
    if (row.coiffeur_id !== coiffeurId) {
      throw new ForbiddenException();
    }
    if (row.status !== 'pending') {
      throw new BadRequestException('This request has already been decided');
    }
    await this.updateRow(id, { status: decision });
    if (decision === 'confirmed') {
      this.events.emit('appointment.confirmed', {
        appointmentId: id,
        particulierId: row.particulier_id,
        serviceName: row.service_name,
        startsAt: row.starts_at,
      });
    }
  }

  // ─── Shared helpers ──────────────────────────────────────────────────────

  private parseFutureDate(iso: string): Date {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()) || date.getTime() < Date.now()) {
      throw new BadRequestException('startsAt must be a valid date in the future');
    }
    return date;
  }

  private assertStillActive(row: AppointmentRow): void {
    if (row.status !== 'pending' && row.status !== 'confirmed') {
      throw new BadRequestException('This appointment can no longer be modified');
    }
  }

  /** Within opening hours, outside the lunch break, and not overlapping another active booking. */
  private async assertSlotAvailable(
    coiffeurId: string,
    startsAt: Date,
    durationMin: number,
    excludeAppointmentId?: string,
  ): Promise<void> {
    const availability = await this.salon.getAvailability(coiffeurId);
    const day = availability.find((d) => d.weekday === startsAt.getDay());
    const startMinutes = startsAt.getHours() * 60 + startsAt.getMinutes();
    const endMinutes = startMinutes + durationMin;

    if (!day?.isOpen || startMinutes < day.opensMinute || endMinutes > day.closesMinute) {
      throw new BadRequestException("Selected time is outside the salon's opening hours");
    }
    if (
      day.breakStartMinute !== null &&
      day.breakEndMinute !== null &&
      startMinutes < day.breakEndMinute &&
      endMinutes > day.breakStartMinute
    ) {
      throw new BadRequestException("Selected time falls inside the salon's break");
    }

    const active = (await this.rowsWhere('coiffeur_id', coiffeurId)).filter(
      (row) => row.status === 'pending' || row.status === 'confirmed',
    );
    const startMs = startsAt.getTime();
    const endMs = startMs + durationMin * 60000;
    const conflict = active.some(
      (row) => row.id !== excludeAppointmentId && overlaps(startMs, endMs, row),
    );
    if (conflict) {
      throw new BadRequestException('This slot is no longer available');
    }
  }

  private async rowsWhere(column: 'particulier_id' | 'coiffeur_id', value: string): Promise<AppointmentRow[]> {
    const { data, error } = await this.supabase.client.from('appointments').select().eq(column, value);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data as AppointmentRow[];
  }

  private async rowOrThrow(id: string): Promise<AppointmentRow> {
    const { data, error } = await this.supabase.client.from('appointments').select().eq('id', id).maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException('Appointment not found');
    }
    return data as AppointmentRow;
  }

  private async updateRow(id: string, patch: Record<string, unknown>): Promise<AppointmentRow> {
    const { data, error } = await this.supabase.client
      .from('appointments')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data as AppointmentRow;
  }

  private async salonNamesFor(coiffeurIds: string[]): Promise<Map<string, string>> {
    if (coiffeurIds.length === 0) return new Map();
    const { data, error } = await this.supabase.client
      .from('coiffeur_profiles')
      .select()
      .in('profile_id', coiffeurIds);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return new Map(
      (data as { profile_id: string; salon_name: string }[]).map((row) => [row.profile_id, row.salon_name]),
    );
  }

  private async particulierNamesFor(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const { data, error } = await this.supabase.client.from('profiles').select().in('id', ids);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return new Map(
      (data as { id: string; first_name: string; last_name: string }[]).map((row) => [
        row.id,
        `${row.first_name} ${row.last_name}`.trim() || 'Client',
      ]),
    );
  }

  private mapParticulier(row: AppointmentRow, salonName: string, now = new Date()): ParticulierAppointment {
    return {
      id: row.id,
      salonId: row.coiffeur_id,
      salonName,
      serviceId: row.service_id,
      serviceName: row.service_name,
      startsAt: row.starts_at,
      durationMin: row.duration_min,
      price: Number(row.price),
      status: derivedStatus(row, now),
      createdAt: row.created_at,
    };
  }

  private mapCoiffeur(
    row: AppointmentRow,
    clientName: string,
    isNewClient: boolean,
    now = new Date(),
  ): CoiffeurAppointment {
    return {
      id: row.id,
      serviceId: row.service_id,
      clientId: row.particulier_id,
      clientName,
      startsAt: row.starts_at,
      durationMin: row.duration_min,
      price: Number(row.price),
      status: derivedStatus(row, now),
      note: row.client_note ?? undefined,
      isNewClient,
    };
  }
}
