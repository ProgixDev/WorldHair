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
import { SupabaseService } from '../database/supabase.service';
import { StaffService } from '../staff/staff.service';

/**
 * The end-of-service code (TODO.md): when the job is done, the salon (or the
 * person who did it) shows a QR code in the app; the client scans it with
 * their own phone, which tells WorldHair they confirmed the service was
 * done. Proof of presence for reviews (« avis vérifié ») and for disputes —
 * it changes nothing about when the salon is paid.
 *
 * The code is random, lasts a few minutes and replaces the last one shown,
 * so a photo of it is worthless later; scanning it only works for the
 * booking's own client, logged in.
 */

export interface CompletionCode {
  code: string;
  /** ISO — the app shows a new one before this. */
  expiresAt: string;
}

/** What the client's confirmation screen says. */
export interface PresenceConfirmation {
  appointmentId: string;
  salonName: string;
  serviceName: string;
  startsAt: string;
  confirmedAt: string;
}

export interface AppointmentPresenceConfirmedEvent {
  appointmentId: string;
  coiffeurId: string;
  /** The person of the team who did it, to be told as well. */
  staffId: string | null;
  serviceName: string;
  startsAt: string;
}

interface BookingRow {
  id: string;
  particulier_id: string | null;
  coiffeur_id: string | null;
  staff_id: string | null;
  service_name: string;
  starts_at: string;
  duration_min: number;
  status: string;
  attendance: string | null;
  confirmed_by_client_at: string | null;
}

interface CodeRow {
  code: string;
  appointment_id: string;
  expires_at: string;
}

const CODE_LENGTH = 12;
/** No 0/O, 1/I: same alphabet as the team's invite codes. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LIFETIME_MS = 5 * 60_000;
/** A code can be shown from the start of the booking until this long after its end. */
const AFTER_END_MS = 12 * 3_600_000;

function newCode(): string {
  return Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}

@Injectable()
export class PresenceService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly staff: StaffService,
    private readonly events: EventEmitter2,
  ) {}

  /** A fresh code for a booking in progress. The salon, or the staff member whose booking it is. */
  async issue(actorId: string, appointmentId: string): Promise<CompletionCode> {
    const row = await this.rowOrThrow(appointmentId);
    await this.assertMine(actorId, row);
    if (row.status !== 'confirmed') {
      throw new BadRequestException('Only an accepted appointment has an end-of-service code');
    }
    if (row.attendance === 'no_show') {
      throw new BadRequestException('This appointment is marked absent');
    }
    if (row.confirmed_by_client_at) {
      throw new ConflictException('ALREADY_CONFIRMED: the client already confirmed this appointment');
    }
    const now = Date.now();
    const start = new Date(row.starts_at).getTime();
    if (start > now) {
      throw new BadRequestException("This appointment hasn't started yet");
    }
    if (now > start + row.duration_min * 60_000 + AFTER_END_MS) {
      throw new BadRequestException('This appointment is too long past for a code');
    }

    // One live code per booking, and no dead ones piling up.
    await this.supabase.client.from('completion_codes').delete().eq('appointment_id', appointmentId);
    await this.supabase.client.from('completion_codes').delete().lt('expires_at', new Date(now).toISOString());
    const expiresAt = new Date(now + CODE_LIFETIME_MS).toISOString();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = newCode();
      const { error } = await this.supabase.client
        .from('completion_codes')
        .insert({ code, appointment_id: appointmentId, expires_at: expiresAt });
      if (!error) return { code, expiresAt };
      // A code already taken (one chance in 10^18) gets another.
      if (error.code !== '23505') {
        throw new InternalServerErrorException(error.message);
      }
    }
    throw new InternalServerErrorException('Could not make a code');
  }

  /** Has the client scanned yet? The salon's screen asks while it shows the code. */
  async status(actorId: string, appointmentId: string): Promise<{ confirmedByClientAt: string | null }> {
    const row = await this.rowOrThrow(appointmentId);
    await this.assertMine(actorId, row);
    return { confirmedByClientAt: row.confirmed_by_client_at };
  }

  /**
   * The client scanned a code: the booking reads as done and confirmed by
   * them. Only for its own client; a second scan answers the same.
   */
  async confirm(clientId: string, rawCode: string): Promise<PresenceConfirmation> {
    const code = rawCode.trim().toUpperCase();
    const { data, error } = await this.supabase.client.from('completion_codes').select().eq('code', code).maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    const found = data as CodeRow | null;
    if (!found || new Date(found.expires_at).getTime() < Date.now()) {
      throw new NotFoundException('INVALID_CODE: this code is unknown or has expired');
    }

    const row = await this.rowOrThrow(found.appointment_id);
    if (!row.particulier_id || row.particulier_id !== clientId) {
      throw new ForbiddenException('NOT_YOUR_APPOINTMENT: this appointment is not yours');
    }
    if (row.status !== 'confirmed') {
      throw new ConflictException('NOT_CONFIRMED: this appointment is no longer on');
    }

    let confirmedAt = row.confirmed_by_client_at;
    if (!confirmedAt) {
      confirmedAt = new Date().toISOString();
      const { error: updateError } = await this.supabase.client
        .from('appointments')
        .update({ confirmed_by_client_at: confirmedAt, attendance: 'attended' })
        .eq('id', row.id)
        .is('confirmed_by_client_at', null)
        .select()
        .maybeSingle();
      if (updateError) {
        throw new InternalServerErrorException(updateError.message);
      }
      if (row.coiffeur_id) {
        this.events.emit('appointment.presence_confirmed', {
          appointmentId: row.id,
          coiffeurId: row.coiffeur_id,
          staffId: row.staff_id,
          serviceName: row.service_name,
          startsAt: row.starts_at,
        } satisfies AppointmentPresenceConfirmedEvent);
      }
    }
    return {
      appointmentId: row.id,
      salonName: await this.salonNameOf(row.coiffeur_id),
      serviceName: row.service_name,
      startsAt: row.starts_at,
      confirmedAt,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** The salon's owner, or the staff member the booking is given to — nobody else shows its code. */
  private async assertMine(actorId: string, row: BookingRow): Promise<void> {
    if (row.coiffeur_id === actorId) return;
    const membership = await this.staff.membershipOf(actorId);
    if (membership && row.staff_id && membership.staffId === row.staff_id) return;
    throw new ForbiddenException();
  }

  private async rowOrThrow(appointmentId: string): Promise<BookingRow> {
    const { data, error } = await this.supabase.client.from('appointments').select().eq('id', appointmentId).maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException('Appointment not found');
    }
    return data as unknown as BookingRow;
  }

  private async salonNameOf(salonId: string | null): Promise<string> {
    if (!salonId) return '';
    const { data } = await this.supabase.client.from('coiffeur_profiles').select('salon_name').eq('profile_id', salonId).maybeSingle();
    return (data as { salon_name: string } | null)?.salon_name ?? '';
  }
}
