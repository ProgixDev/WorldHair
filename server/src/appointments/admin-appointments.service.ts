import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PaginationOptions } from '../common/dto/pagination-query.dto';
import { parisTime } from '../common/utils/paris-time';
import { SupabaseService } from '../database/supabase.service';
import { PaymentRow } from '../payments/payments.service';
import {
  AppointmentLine,
  AppointmentRow,
  AppointmentStatus,
  Attendance,
  CancelledBy,
  derivedStatus,
  linesOf,
  paymentOf,
  WITH_LINES,
} from './appointments.service';

/** The list's status filter, as the apps read a booking: `upcoming` is accepted and not over yet, `done` accepted and over. */
export const ADMIN_APPOINTMENT_STATUSES = ['pending', 'upcoming', 'done', 'refused', 'cancelled'] as const;
export type AdminAppointmentStatusFilter = (typeof ADMIN_APPOINTMENT_STATUSES)[number];

export interface AdminAppointmentQuery extends Partial<PaginationOptions> {
  status?: AdminAppointmentStatusFilter;
  /** Every word, accents aside, in the salon's name or its coiffeur's. */
  salon?: string;
  /** Every word, accents aside, in the client's name. */
  client?: string;
  /** Paris days (YYYY-MM-DD), both included: when the booking starts. */
  from?: string;
  to?: string;
  now?: Date;
}

export interface AdminAppointmentPayment {
  status: PaymentRow['status'];
  amount: number;
  refundedAmount: number;
  commissionAmount: number;
  /** What the salon kept of its payout, anything taken back since deducted; `null` until paid out. */
  transferAmount: number | null;
  transferredAt: string | null;
}

export interface AdminAppointmentSummary {
  id: string;
  startsAt: string;
  durationMin: number;
  /** Every prestation's name, joined. */
  serviceName: string;
  price: number;
  status: AppointmentStatus;
  attendance: Attendance | null;
  cancelledBy: CancelledBy | null;
  salon: { id: string; name: string };
  client: { id: string; name: string };
  /** `null` for a booking made before payments. */
  payment: AdminAppointmentPayment | null;
  createdAt: string;
}

/** One booking in full, for a dispute: who to reach on both sides, and where its money is. */
export interface AdminAppointmentDetail extends AdminAppointmentSummary {
  services: AppointmentLine[];
  note: string | null;
  cancellationReason: string | null;
  client: { id: string; name: string; email: string | null };
  salon: { id: string; name: string; phone: string; city: string; email: string | null };
  /** `paymentIntentId`: to find it in Stripe's dashboard. */
  payment: (AdminAppointmentPayment & { paymentIntentId: string | null }) | null;
}

/** A row of admin_appointments() (schema.sql). */
interface AdminAppointmentRow {
  id: string;
  particulier_id: string;
  coiffeur_id: string;
  service_name: string;
  price: number | string;
  duration_min: number;
  starts_at: string;
  status: string;
  attendance: string | null;
  cancelled_by: CancelledBy | null;
  created_at: string;
  salon_name: string | null;
  stylist_first_name: string | null;
  stylist_last_name: string | null;
  client_first_name: string | null;
  client_last_name: string | null;
  payment_status: PaymentRow['status'] | null;
  payment_amount: number | string | null;
  refunded_amount: number | string | null;
  commission_amount: number | string | null;
  transfer_amount: number | string | null;
  reversed_amount: number | string | null;
  transferred_at: string | null;
  total_count: number | string;
}

const DEFAULT_LIMIT = 20;
const round2 = (euros: number) => Math.round(euros * 100) / 100;

/** "Camille Durand", or a stand-in for a blank profile. */
function fullName(first: string | null | undefined, last: string | null | undefined, fallback: string): string {
  return [first, last].filter(Boolean).join(' ').trim() || fallback;
}

/** A salon by its shop name; a coiffeur who never named it, by their own. */
function salonName(row: { salon_name: string | null; stylist_first_name: string | null; stylist_last_name: string | null }): string {
  return row.salon_name?.trim() || fullName(row.stylist_first_name, row.stylist_last_name, 'Salon');
}

/** The instant a Paris day starts, `plusDays` later. */
function parisDayStart(day: string, plusDays = 0): string {
  const [year, month, date] = day.split('-').map(Number);
  return parisTime(year, month, date + plusDays).toISOString();
}

function toPayment(payment: {
  status: PaymentRow['status'];
  amount: number | string;
  refunded_amount: number | string;
  commission_amount: number | string;
  transfer_amount: number | string | null;
  reversed_amount: number | string;
  transferred_at: string | null;
}): AdminAppointmentPayment {
  return {
    status: payment.status,
    amount: Number(payment.amount),
    refundedAmount: Number(payment.refunded_amount),
    commissionAmount: Number(payment.commission_amount),
    transferAmount:
      payment.transfer_amount === null ? null : round2(Number(payment.transfer_amount) - Number(payment.reversed_amount)),
    transferredAt: payment.transferred_at,
  };
}

/**
 * The admins' « Rendez-vous » (TODO.md Phase 7): every booking, filtered and
 * a page at a time (admin_appointments() does the filtering, so paging
 * stays right whatever the filters), and one in full for a dispute.
 * Cancelling one goes through AppointmentsService.cancelByAdmin, with the
 * rest of the booking lifecycle.
 */
@Injectable()
export class AdminAppointmentsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(query: AdminAppointmentQuery): Promise<{ items: AdminAppointmentSummary[]; total: number }> {
    const now = query.now ?? new Date();
    const { data, error } = await this.supabase.client.rpc('admin_appointments', {
      p_status: query.status ?? null,
      p_salon: query.salon?.trim() || null,
      p_client: query.client?.trim() || null,
      p_from: query.from ? parisDayStart(query.from) : null,
      // Up to the end of that day.
      p_to: query.to ? parisDayStart(query.to, 1) : null,
      p_now: now.toISOString(),
      p_limit: query.limit ?? DEFAULT_LIMIT,
      p_offset: query.offset ?? 0,
    });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    const rows = data as AdminAppointmentRow[];
    return {
      items: rows.map((row) => this.toSummary(row, now)),
      // An empty page (past the end) carries no count: ask the first page for it.
      total: rows.length > 0 ? Number(rows[0].total_count) : await this.totalOf(query, now),
    };
  }

  async detail(id: string, now = new Date()): Promise<AdminAppointmentDetail> {
    const { data, error } = await this.supabase.client.from('appointments').select(WITH_LINES).eq('id', id).maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException('Appointment not found');
    }
    const row = data as unknown as AppointmentRow;

    const [salon, application, client, clientEmail, salonEmail] = await Promise.all([
      this.single<{ salon_name: string; phone: string; city: string }>('coiffeur_profiles', 'profile_id', row.coiffeur_id),
      this.single<{ first_name: string; last_name: string }>('coiffeur_applications', 'profile_id', row.coiffeur_id),
      this.single<{ first_name: string; last_name: string }>('profiles', 'id', row.particulier_id),
      this.emailOf(row.particulier_id),
      this.emailOf(row.coiffeur_id),
    ]);
    const payment = paymentOf(row);

    return {
      id: row.id,
      startsAt: row.starts_at,
      durationMin: row.duration_min,
      serviceName: row.service_name,
      price: Number(row.price),
      status: derivedStatus(row, now),
      attendance: (row.attendance as Attendance | null | undefined) ?? null,
      cancelledBy: row.cancelled_by ?? null,
      cancellationReason: row.cancellation_reason ?? null,
      services: linesOf(row),
      note: row.client_note,
      salon: {
        id: row.coiffeur_id,
        name: salonName({
          salon_name: salon?.salon_name ?? null,
          stylist_first_name: application?.first_name ?? null,
          stylist_last_name: application?.last_name ?? null,
        }),
        phone: salon?.phone ?? '',
        city: salon?.city ?? '',
        email: salonEmail,
      },
      client: { id: row.particulier_id, name: fullName(client?.first_name, client?.last_name, 'Client'), email: clientEmail },
      payment: payment ? { ...toPayment(payment), paymentIntentId: payment.payment_intent_id } : null,
      createdAt: row.created_at,
    };
  }

  private toSummary(row: AdminAppointmentRow, now: Date): AdminAppointmentSummary {
    return {
      id: row.id,
      startsAt: row.starts_at,
      durationMin: row.duration_min,
      serviceName: row.service_name,
      price: Number(row.price),
      status: derivedStatus(row, now),
      attendance: (row.attendance as Attendance | null) ?? null,
      cancelledBy: row.cancelled_by,
      salon: { id: row.coiffeur_id, name: salonName(row) },
      client: { id: row.particulier_id, name: fullName(row.client_first_name, row.client_last_name, 'Client') },
      payment:
        row.payment_status === null
          ? null
          : toPayment({
              status: row.payment_status,
              amount: row.payment_amount ?? 0,
              refunded_amount: row.refunded_amount ?? 0,
              commission_amount: row.commission_amount ?? 0,
              transfer_amount: row.transfer_amount,
              reversed_amount: row.reversed_amount ?? 0,
              transferred_at: row.transferred_at,
            }),
      createdAt: row.created_at,
    };
  }

  private async totalOf(query: AdminAppointmentQuery, now: Date): Promise<number> {
    if (!query.offset) return 0;
    return (await this.list({ ...query, now, limit: 1, offset: 0 })).total;
  }

  private async single<T>(table: string, column: string, value: string): Promise<T | null> {
    const { data, error } = await this.supabase.client.from(table).select().eq(column, value).maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data as T | null;
  }

  /** Where to reach them about the dispute; `null` for an account since deleted. */
  private async emailOf(profileId: string): Promise<string | null> {
    const {
      data: { user },
      error,
    } = await this.supabase.client.auth.admin.getUserById(profileId);
    return error ? null : (user?.email ?? null);
  }
}
