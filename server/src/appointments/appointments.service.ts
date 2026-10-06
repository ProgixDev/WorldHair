import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type Stripe from 'stripe';
import { CoiffeurApplicationsService } from '../coiffeur/coiffeur-applications.service';
import { Role } from '../common/types/role';
import { isAccountActive } from '../common/utils/account-status';
import { allPages } from '../common/utils/pages';
import { formatParisDateTime } from '../common/utils/paris-time';
import { slices } from '../common/utils/slices';
import { findSalonSubscription, isSalonListed } from '../common/utils/subscription-status';
import { subscriptionEndsAt } from '../subscriptions/subscription-state';
import { SupabaseService } from '../database/supabase.service';
import { PaymentRow, PaymentsService, RefundReason } from '../payments/payments.service';
import { PayoutAccountsService } from '../payments/payout-accounts.service';
import { SalonProfile, SalonService, SalonServiceItem } from '../salon/salon.service';
import { StaffMember, StaffService } from '../staff/staff.service';
import {
  BusyBooking,
  closedAfter,
  DaySlots,
  PersonRules,
  pickPerson,
  refusalFor,
  SlotRefusal,
  slotsForTeam,
  teamRefusal,
} from './booking-rules';

/**
 * "done" is NOT a stored status (see schema.sql's appointments table) — it's
 * derived here, at read time, from "confirmed AND already past". No cron or
 * background job transitions it; nothing in the product ever needs to act on
 * the transition itself, only ever read the resulting label.
 */
export type AppointmentStatus = 'awaiting_payment' | 'pending' | 'confirmed' | 'refused' | 'cancelled' | 'done';

/** Set by the coiffeur once an accepted appointment has started; `null` until then. */
export type Attendance = 'attended' | 'no_show';

/** Who cancelled a booking: its client, its salon, WorldHair (a dispute), or the job expiring an unanswered request. */
export type CancelledBy = 'client' | 'salon' | 'admin' | 'system';

/** One prestation of a booking — a snapshot, so editing or deleting the service later never changes what was booked. */
export interface AppointmentLine {
  serviceId: string | null;
  name: string;
  price: number;
  durationMin: number;
}

export interface ParticulierAppointment {
  id: string;
  /** Null once the salon deleted its account: the booking stays in the client's history. */
  salonId: string | null;
  salonName: string;
  /** First prestation — kept for older app versions; `services` has them all. */
  serviceId: string | null;
  /** Every prestation's name, joined: "Couleur + Coupe & brushing". */
  serviceName: string;
  startsAt: string;
  /** Total of every prestation. */
  durationMin: number;
  /** Total of every prestation. */
  price: number;
  services: AppointmentLine[];
  status: AppointmentStatus;
  attendance: Attendance | null;
  /** Until when the particulier may still cancel or move it; `null` once it can't be changed at all (cancelled, refused). */
  modifiableUntil: string | null;
  /** The salon moved it: the particulier can change it until it starts, whatever the salon's notice. */
  movedBySalon: boolean;
  /** What the client paid in the app, and got back; `null` for a booking made before payments. */
  payment: { amount: number; refundedAmount: number } | null;
  /** Who cancelled it; `null` unless cancelled (and on bookings cancelled before it was kept). */
  cancelledBy: CancelledBy | null;
  /** WorldHair's reason, when it cancelled — both sides are also sent it. */
  cancellationReason: string | null;
  /** The client scanned the salon's end-of-service code: they confirmed it was done. */
  confirmedByClientAt: string | null;
  createdAt: string;
}

/** The salon's side of a payment: its share, and when it was sent. */
export interface CoiffeurPayment {
  amount: number;
  refundedAmount: number;
  /** WorldHair's commission on what the client kept. */
  commissionAmount: number;
  /** What the salon receives (or received). */
  payoutAmount: number;
  /** When it was transferred; `null` until a day after the appointment. */
  paidOutAt: string | null;
}

/** POST /appointments: the held booking, and Stripe's payment page for it — the app opens it in the browser. */
export interface HeldAppointment {
  appointment: ParticulierAppointment;
  payment: { url: string; amount: number };
}

export interface CoiffeurAppointment {
  id: string;
  serviceId: string | null;
  /** Null once the client deleted their account: the booking stays in the salon's history. */
  clientId: string | null;
  clientName: string;
  startsAt: string;
  durationMin: number;
  price: number;
  services: AppointmentLine[];
  status: AppointmentStatus;
  attendance: Attendance | null;
  note?: string;
  /** First-ever booking from this client at this salon. */
  isNewClient: boolean;
  payment: CoiffeurPayment | null;
  cancelledBy: CancelledBy | null;
  cancellationReason: string | null;
  /** The client scanned the end-of-service code: they confirmed it was done. */
  confirmedByClientAt: string | null;
  /** Who in the salon's team does it (TODO.md Phase 3); `null` for a booking whose person has left. */
  staffId: string | null;
  staffName: string | null;
}

/** Someone of the salon's team, free or not at a booking's time (TODO.md Phase 3). */
export interface StaffCandidate {
  staffId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  isOwner: boolean;
  free: boolean;
  /** The person the booking has now (held when the client booked). */
  held: boolean;
}

export interface CreateAppointmentInput {
  coiffeurId: string;
  /** In the order picked: they run back to back, durations and prices add up. */
  serviceIds?: string[];
  /** What older app versions send — a single prestation. */
  serviceId?: string;
  startsAt: string;
  note?: string;
}

export interface SlotsQuery {
  /** YYYY-MM-DD, Paris calendar. */
  date: string;
  /** A new booking: the slots fit these prestations back to back. */
  serviceIds?: string[];
  /** Moving an existing booking: the slots fit its length, and its own time isn't counted as taken. */
  appointmentId?: string;
}

interface AppointmentServiceRow {
  service_id: string | null;
  service_name: string;
  price: string | number;
  duration_min: number;
  position: number;
}

export interface AppointmentRow {
  id: string;
  /** Null once that side deleted their account (TODO.md Phase 8): the booking stays, anonymized. */
  particulier_id: string | null;
  coiffeur_id: string | null;
  /** The person of the salon's team holding it (TODO.md Phase 3); none on a booking whose person left. */
  staff_id?: string | null;
  service_id: string | null;
  service_name: string;
  price: string | number;
  duration_min: number;
  starts_at: string;
  status: string;
  client_note: string | null;
  attendance?: string | null;
  /** The salon's cancellation notice when the client booked; `null` on bookings made before it was kept. */
  cancellation_notice_minutes?: number | null;
  moved_by_salon?: boolean;
  /** Set on a cancellation (see CancelledBy); `null` otherwise, and on bookings cancelled before it was kept. */
  cancelled_by?: CancelledBy | null;
  /** An admin's cancellation only: why, as both sides were told. */
  cancellation_reason?: string | null;
  /** The client scanned the salon's end-of-service code (`PresenceService`). */
  confirmed_by_client_at?: string | null;
  created_at: string;
  /** Embedded by `select(WITH_LINES)`. */
  appointment_services?: AppointmentServiceRow[];
  /** Embedded by `select(WITH_LINES)` — one-to-one, so an object (a list from older PostgREST). */
  payments?: PaymentRow | PaymentRow[] | null;
}

/** An appointment row with its prestations and its payment embedded — one round-trip, whatever the number of bookings. */
export const WITH_LINES = '*, appointment_services(*), payments(*)';

/** How long a slot stays held for a client paying (TODO.md Phase 5). */
export const PAYMENT_HOLD_MS = 15 * 60_000;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** English, for logs and the apps' own French mapping (mobile/src/services/booking.ts keys on these words). */
const REFUSAL_MESSAGES: Record<SlotRefusal, string> = {
  past: 'startsAt must be a valid date in the future',
  too_soon: 'This salon needs more notice before a booking',
  closed: "Selected time is outside the salon's opening hours",
  outside_hours: "Selected time is outside the salon's opening hours",
  break: "Selected time falls inside the salon's break",
  time_off: 'The salon is closed at that time',
  taken: 'This slot is no longer available',
  client_busy: 'You already have an appointment at that time',
  staff_off: 'Nobody in the salon is available at that time',
};

const NOT_FREE = 'This person is not free at that time';

/** Who can take a booking: a client's goes to those who take bookings; the owner can give one to anybody. */
type Members = 'bookable' | 'all';

interface TeamRulesOptions {
  particulierId?: string;
  excludeAppointmentId?: string;
  ignoreHoldsOf?: string;
  bookingNoticeMinutes: number;
  members: Members;
  /** Kept in whatever `members` says: the person a booking already has. */
  alsoStaffId?: string | null;
}

function endTimeMs(row: { starts_at: string; duration_min: number }): number {
  return new Date(row.starts_at).getTime() + row.duration_min * MINUTE_MS;
}

/** Exported for ReviewsService — a review may only be left once its appointment shows as "done". */
export function derivedStatus(
  row: Pick<AppointmentRow, 'status' | 'starts_at' | 'duration_min'>,
  now: Date = new Date(),
): AppointmentStatus {
  if (row.status === 'confirmed' && endTimeMs(row) < now.getTime()) return 'done';
  return row.status as AppointmentStatus;
}

/** What a booking whose side deleted their account reads as (TODO.md Phase 8). */
export const DELETED_SALON = 'Salon supprimé';
export const DELETED_CLIENT = 'Client supprimé';

/**
 * The salon of a booking still to come — it always has one: deleting an
 * account cancels its bookings first. A past one may have lost it.
 */
function salonOf(row: AppointmentRow): string {
  if (!row.coiffeur_id) throw new BadRequestException('This salon has left WorldHair');
  return row.coiffeur_id;
}

function clientOf(row: AppointmentRow): string {
  if (!row.particulier_id) throw new BadRequestException('This client has left WorldHair');
  return row.particulier_id;
}

function isActive(row: AppointmentRow): boolean {
  return row.status === 'pending' || row.status === 'confirmed';
}

/** A booking, or a slot held while its client pays: either keeps the time from anyone else. */
function holdsSlot(row: AppointmentRow): boolean {
  return isActive(row) || row.status === 'awaiting_payment';
}

const round2 = (euros: number) => Math.round(euros * 100) / 100;

export function paymentOf(row: AppointmentRow): PaymentRow | null {
  const embedded = row.payments;
  return Array.isArray(embedded) ? (embedded[0] ?? null) : (embedded ?? null);
}

function clientPayment(row: AppointmentRow): ParticulierAppointment['payment'] {
  const payment = paymentOf(row);
  if (!payment || payment.status !== 'succeeded') return null;
  return { amount: Number(payment.amount), refundedAmount: Number(payment.refunded_amount) };
}

function salonPayment(row: AppointmentRow): CoiffeurPayment | null {
  const payment = paymentOf(row);
  if (!payment || payment.status !== 'succeeded') return null;
  const kept = round2(Number(payment.amount) - Number(payment.refunded_amount));
  const paidOut = payment.transfer_amount !== null;
  const commission = paidOut ? Number(payment.commission_amount) : round2((kept * Number(payment.commission_rate)) / 100);
  return {
    amount: Number(payment.amount),
    refundedAmount: Number(payment.refunded_amount),
    commissionAmount: commission,
    // Paid out: what the salon kept of its transfer, after anything WorldHair took back for an admin refund.
    payoutAmount: paidOut ? round2(Number(payment.transfer_amount) - Number(payment.reversed_amount)) : round2(kept - commission),
    paidOutAt: payment.transferred_at,
  };
}

function toBusy(row: AppointmentRow): BusyBooking {
  return { startsAt: row.starts_at, durationMin: row.duration_min };
}

function toLine(service: SalonServiceItem): AppointmentLine {
  return { serviceId: service.id, name: service.name, price: service.price, durationMin: service.durationMin };
}

/** Bookings made before several prestations were possible have no lines: their own snapshot is the one line. */
export function linesOf(row: AppointmentRow): AppointmentLine[] {
  const lines = row.appointment_services ?? [];
  if (lines.length === 0) {
    return [{ serviceId: row.service_id, name: row.service_name, price: Number(row.price), durationMin: row.duration_min }];
  }
  return [...lines]
    .sort((a, b) => a.position - b.position)
    .map((line) => ({
      serviceId: line.service_id,
      name: line.service_name,
      price: Number(line.price),
      durationMin: line.duration_min,
    }));
}

/**
 * Until when the particulier may still cancel or move a booking: never once
 * it has started. An accepted booking closes earlier, by the salon's
 * cancellation notice as it stood when the client booked — a salon changing
 * it later never traps anyone. A request the salon hasn't accepted yet, or a
 * time the salon imposed by moving the booking, stays open until the start.
 */
function modifiableUntil(row: AppointmentRow, salonNoticeMinutes: number): string | null {
  if (!isActive(row)) return null;
  const noticeMinutes =
    row.status === 'confirmed' && !row.moved_by_salon ? (row.cancellation_notice_minutes ?? salonNoticeMinutes) : 0;
  return new Date(new Date(row.starts_at).getTime() - noticeMinutes * MINUTE_MS).toISOString();
}

/**
 * "Rendez-vous / Agenda" — the shared booking lifecycle both the particulier
 * and coiffeur sides read/write, just through different lenses (see the two
 * response shapes above). A request starts `pending` (or `confirmed` straight
 * away for an instant-confirmation salon); the coiffeur accepts or refuses
 * it; either side can cancel an active one; the coiffeur can move an
 * accepted one and mark it attended or missed. Every start goes through the
 * same booking rules (booking-rules.ts) the slot grid is built from.
 */
@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly applications: CoiffeurApplicationsService,
    private readonly salon: SalonService,
    private readonly events: EventEmitter2,
    private readonly payments: PaymentsService,
    private readonly payouts: PayoutAccountsService,
    private readonly staff: StaffService,
  ) {}

  // ─── Create (particulier) ────────────────────────────────────────────────

  /**
   * Holds the slot and opens Stripe's payment page for the total (TODO.md
   * Phase 5): the client pays there, in the browser, and only then does the
   * salon get the request (`completePayment` when they're back in the app,
   * or Stripe's webhook). An unpaid hold is released after PAYMENT_HOLD_MS.
   */
  async create(particulierId: string, input: CreateAppointmentInput): Promise<HeldAppointment> {
    const serviceIds = [...new Set(input.serviceIds ?? (input.serviceId ? [input.serviceId] : []))];
    if (serviceIds.length === 0) {
      throw new BadRequestException('Pick at least one service');
    }

    const profile = await this.bookableSalon(input.coiffeurId);
    if (!(await this.payouts.isBookable(input.coiffeurId))) {
      throw new BadRequestException('This salon does not take online bookings yet');
    }
    const services = await this.salon.listServices(input.coiffeurId, { activeOnly: true });
    const lines = serviceIds.map((id) => {
      const service = services.find((item) => item.id === id);
      if (!service) {
        throw new NotFoundException('Service not found');
      }
      return toLine(service);
    });
    const durationMin = lines.reduce((sum, line) => sum + line.durationMin, 0);
    const price = lines.reduce((sum, line) => sum + line.price, 0);
    const serviceName = lines.map((line) => line.name).join(' + ');

    const startsAt = this.parseDate(input.startsAt);
    // One payment at a time per client: going back, or starting over, frees their previous hold.
    await this.releaseHoldsOf(particulierId);
    const team = await this.teamRulesFor(input.coiffeurId, {
      particulierId,
      bookingNoticeMinutes: profile.bookingNoticeMinutes,
      members: 'bookable',
    });
    this.assertTeamSlot(team, startsAt, durationMin, 'client');

    const created = await this.insertOnFreePerson(team, startsAt, durationMin, {
      particulier_id: particulierId,
      coiffeur_id: input.coiffeurId,
      service_id: lines[0].serviceId,
      service_name: serviceName,
      price,
      duration_min: durationMin,
      starts_at: startsAt.toISOString(),
      status: 'awaiting_payment',
      client_note: input.note?.trim() || null,
      cancellation_notice_minutes: profile.cancellationNoticeMinutes,
    });

    const { error: linesError } = await this.supabase.client.from('appointment_services').insert(
      lines.map((line, position) => ({
        appointment_id: created.id,
        service_id: line.serviceId,
        service_name: line.name,
        price: line.price,
        duration_min: line.durationMin,
        position,
      })),
    );
    if (linesError) {
      // No transactions through PostgREST: undo the booking rather than leave it without its lines.
      await this.supabase.client.from('appointments').delete().eq('id', created.id);
      throw new InternalServerErrorException(linesError.message);
    }

    let url: string;
    try {
      ({ url } = await this.payments.startPayment({
        appointmentId: created.id,
        particulierId,
        coiffeurId: input.coiffeurId,
        amount: price,
        label: `${profile.salonName} — ${serviceName}`,
        details: `Rendez-vous le ${formatParisDateTime(created.starts_at)}`,
        email: await this.emailOf(particulierId),
      }));
    } catch (err) {
      await this.supabase.client.from('appointments').delete().eq('id', created.id);
      throw err;
    }

    return {
      appointment: this.mapParticulier(created, profile.salonName, profile.cancellationNoticeMinutes, new Date(), lines),
      payment: { url, amount: price },
    };
  }

  // ─── Payment (particulier, Stripe) ───────────────────────────────────────

  /** Back from Stripe's page: Stripe is asked directly, so the request goes out without waiting for its webhook. */
  async completePayment(particulierId: string, id: string): Promise<ParticulierAppointment> {
    let row = await this.rowOrThrow(id);
    if (row.particulier_id !== particulierId) {
      throw new ForbiddenException();
    }
    if (row.status === 'awaiting_payment') {
      const payment = await this.payments.findByAppointment(id);
      const intent = payment ? await this.payments.paidIntent(payment) : null;
      if (payment && intent) row = await this.finalizePayment(row, payment, intent);
    }
    const profile = await this.salon.getProfile(salonOf(row));
    return this.mapParticulier(row, profile.salonName, profile.cancellationNoticeMinutes);
  }

  /** The client left the payment step: the slot goes back to everyone — unless they paid after all. */
  async releaseHold(particulierId: string, id: string): Promise<void> {
    const row = await this.rowOrThrow(id);
    if (row.particulier_id !== particulierId) {
      throw new ForbiddenException();
    }
    await this.releaseRow(row);
  }

  /** Every minute: holds nobody paid within PAYMENT_HOLD_MS. */
  async releaseStaleHolds(now = new Date()): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('appointments')
      .select()
      .eq('status', 'awaiting_payment')
      .lte('created_at', new Date(now.getTime() - PAYMENT_HOLD_MS).toISOString());
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    for (const row of data as AppointmentRow[]) {
      try {
        await this.releaseRow(row);
      } catch (err) {
        this.logger.warn(`Couldn't release hold ${row.id}`, err as Error);
      }
    }
  }

  /**
   * A request the salon never answered before its time can't be accepted
   * any more (see `decide`): it's cancelled, the client refunded and told.
   */
  async expireUnansweredRequests(now = new Date()): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('appointments')
      .select()
      .eq('status', 'pending')
      .lte('starts_at', now.toISOString());
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    for (const row of data as AppointmentRow[]) {
      const { data: expired, error: updateError } = await this.supabase.client
        .from('appointments')
        .update({ status: 'cancelled', cancelled_by: 'system' })
        .eq('id', row.id)
        .eq('status', 'pending')
        .select()
        .maybeSingle();
      if (updateError || !expired) continue;
      const refunded = await this.refundAfter(row.id, 'request_expired');
      this.events.emit('appointment.expired', {
        appointmentId: row.id,
        particulierId: row.particulier_id,
        coiffeurId: row.coiffeur_id,
        serviceName: row.service_name,
        startsAt: row.starts_at,
        refunded,
      });
    }
  }

  /** Stripe's payment events (webhook). */
  async handlePaymentEvent(event: Stripe.Event): Promise<void> {
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object;
      // Found by its appointment: paid on Stripe's page, the intent isn't recorded here until now.
      const appointmentId = intent.metadata?.appointment_id;
      const payment = appointmentId
        ? await this.payments.findByAppointment(appointmentId)
        : await this.payments.findByIntent(intent.id);
      if (!payment) {
        // One of ours whose hold is already gone: nothing was booked.
        if (appointmentId) await this.payments.refundOrphan(intent);
        return;
      }
      const row = await this.findRow(payment.appointment_id);
      if (row) await this.finalizePayment(row, payment, intent);
    } else if (event.type === 'charge.refunded') {
      await this.payments.syncRefund(event.data.object);
    }
  }

  /** The coiffeur gives money back by hand — all or part — until the salon has been paid. */
  async refundByCoiffeur(coiffeurId: string, id: string, amount?: number): Promise<{ refunded: number }> {
    const row = await this.rowOrThrow(id);
    if (row.coiffeur_id !== coiffeurId) {
      throw new ForbiddenException();
    }
    if (row.status !== 'confirmed') {
      throw new BadRequestException('Only an accepted appointment can be refunded by hand');
    }
    const refunded = await this.payments.refund(id, { amount, reason: 'coiffeur_manual' });
    if (refunded === 0) {
      throw new BadRequestException('Nothing was paid in the app for this appointment');
    }
    return { refunded };
  }

  /** Paid: the hold becomes the request (or, for an instant salon, the booking). Only the first call acts. */
  private async finalizePayment(
    row: AppointmentRow,
    payment: PaymentRow,
    intent: Stripe.PaymentIntent,
  ): Promise<AppointmentRow> {
    if (row.status === 'awaiting_payment' && (!row.coiffeur_id || !row.particulier_id)) {
      // Its salon (or client) deleted their account while this was being paid: no booking to make — all of it goes back.
      await this.payments.refundOrphan(intent);
      await this.supabase.client.from('appointments').delete().eq('id', row.id).eq('status', 'awaiting_payment');
      return row;
    }
    if (payment.status !== 'succeeded') await this.payments.markSucceeded(payment, intent);
    if (row.status !== 'awaiting_payment') return row;

    const profile = await this.salon.getProfile(salonOf(row));
    const status = profile.confirmationMode === 'instant' ? 'confirmed' : 'pending';
    const { data, error } = await this.supabase.client
      .from('appointments')
      .update({ status })
      .eq('id', row.id)
      .eq('status', 'awaiting_payment')
      .select(WITH_LINES)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) return (await this.findRow(row.id)) ?? row;

    const updated = data as unknown as AppointmentRow;
    this.events.emit('appointment.created', {
      appointmentId: row.id,
      coiffeurId: row.coiffeur_id,
      serviceName: row.service_name,
      startsAt: row.starts_at,
      status,
    });
    if (status === 'confirmed') {
      this.events.emit('appointment.confirmed', {
        appointmentId: row.id,
        particulierId: row.particulier_id,
        serviceName: row.service_name,
        startsAt: row.starts_at,
      });
      this.emitAssigned(updated);
    }
    return updated;
  }

  private async releaseRow(row: AppointmentRow): Promise<void> {
    if (row.status !== 'awaiting_payment') return;
    const payment = await this.payments.findByAppointment(row.id);
    if (payment) {
      const paid = await this.payments.closeCheckout(payment);
      if (paid) {
        await this.finalizePayment(row, payment, paid);
        return;
      }
    }
    await this.supabase.client.from('appointments').delete().eq('id', row.id).eq('status', 'awaiting_payment');
  }

  private async releaseHoldsOf(particulierId: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('appointments')
      .select()
      .eq('particulier_id', particulierId)
      .eq('status', 'awaiting_payment');
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    for (const row of data as AppointmentRow[]) {
      try {
        await this.releaseRow(row);
      } catch (err) {
        // Left to the stale-hold job; meanwhile an overlapping new hold is refused as usual.
        this.logger.warn(`Couldn't release hold ${row.id}`, err as Error);
      }
    }
  }

  /**
   * The client's money back after a cancellation, a refusal or an expiry.
   * The booking's new status is already written, so a refund Stripe can't
   * make right now (an outage) mustn't fail it: PaymentsService.refundOwed
   * makes it later. Answers what was refunded now.
   */
  private async refundAfter(id: string, reason: RefundReason): Promise<number> {
    try {
      return await this.payments.refund(id, { reason });
    } catch (err) {
      this.logger.error(`Refund for appointment ${id} failed — the job will make it`, err as Error);
      return 0;
    }
  }

  // ─── Particulier: list / reschedule / cancel ────────────────────────────

  async listForParticulier(particulierId: string): Promise<ParticulierAppointment[]> {
    // A slot held for an unfinished payment isn't a booking yet.
    const rows = (await this.rowsWhere('particulier_id', particulierId, WITH_LINES)).filter(
      (row) => row.status !== 'awaiting_payment',
    );
    const salons = await this.salonsFor([...new Set(rows.flatMap((row) => (row.coiffeur_id ? [row.coiffeur_id] : [])))]);
    const now = new Date();
    return rows
      .map((row) => {
        const salon = row.coiffeur_id ? salons.get(row.coiffeur_id) : undefined;
        const name = row.coiffeur_id ? (salon?.name ?? '') : DELETED_SALON;
        return this.mapParticulier(row, name, salon?.cancellationNoticeMinutes ?? 0, now);
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async reschedule(particulierId: string, id: string, startsAtIso: string): Promise<ParticulierAppointment> {
    const row = await this.rowOrThrow(id);
    if (row.particulier_id !== particulierId) {
      throw new ForbiddenException();
    }
    this.assertStillActive(row);
    this.assertNotPast(row);
    const profile = await this.salon.getProfile(salonOf(row));
    this.assertBeforeDeadline(row, profile.cancellationNoticeMinutes);

    const startsAt = this.parseDate(startsAtIso);
    const team = await this.teamRulesFor(salonOf(row), {
      particulierId,
      excludeAppointmentId: id,
      bookingNoticeMinutes: profile.bookingNoticeMinutes,
      members: 'bookable',
      alsoStaffId: row.staff_id,
    });
    this.assertTeamSlot(team, startsAt, row.duration_min, 'client');
    // Its person keeps it when free then; someone else free otherwise.
    const person = pickPerson(team, startsAt, row.duration_min, row.staff_id)!;
    const samePerson = person.staffId === row.staff_id;

    // The client picked this time themselves: the salon's notice binds it again.
    const updated = await this.updateRow(id, {
      starts_at: startsAt.toISOString(),
      staff_id: person.staffId,
      moved_by_salon: false,
    });
    this.events.emit('appointment.rescheduled', {
      appointmentId: id,
      coiffeurId: row.coiffeur_id,
      // Its person hears of it once it's theirs (accepted, not just held), and
      // as moved only when it stays theirs: someone new hears of it as theirs.
      staffId: row.status === 'confirmed' && samePerson ? person.staffId : null,
      serviceName: row.service_name,
      previousStartsAt: row.starts_at,
      startsAt: updated.starts_at,
    });
    if (row.status === 'confirmed' && !samePerson) this.emitAssigned(updated);
    return this.mapParticulier(updated, profile.salonName, profile.cancellationNoticeMinutes);
  }

  async cancel(currentUserId: string, id: string): Promise<void> {
    const row = await this.rowOrThrow(id);
    if (row.particulier_id !== currentUserId && row.coiffeur_id !== currentUserId) {
      throw new ForbiddenException();
    }
    this.assertStillActive(row);
    this.assertNotPast(row);
    // The salon's deadline binds the client only — a salon can always cancel (the client is notified).
    if (currentUserId === row.particulier_id) {
      const profile = await this.salon.getProfile(salonOf(row));
      this.assertBeforeDeadline(row, profile.cancellationNoticeMinutes);
    }
    // Only while still active: the salon may have refused it, or the job expired it, meanwhile.
    await this.updateWhileStatus(
      id,
      ['pending', 'confirmed'],
      { status: 'cancelled', cancelled_by: currentUserId === row.particulier_id ? 'client' : 'salon' },
      'This appointment can no longer be modified',
    );
    // In time (the client) or not their fault (the salon): the client gets everything back.
    await this.refundAfter(id, currentUserId === row.particulier_id ? 'client_cancelled' : 'salon_cancelled');
    this.events.emit('appointment.cancelled', {
      appointmentId: id,
      coiffeurId: row.coiffeur_id,
      particulierId: row.particulier_id,
      staffId: row.status === 'confirmed' ? (row.staff_id ?? null) : null,
      cancelledByUserId: currentUserId,
      serviceName: row.service_name,
      startsAt: row.starts_at,
    });
  }

  // ─── Account deletion ────────────────────────────────────────────────────

  /**
   * An account being deleted (TODO.md Phase 8): its slots held for a
   * payment go back to everyone — or, paid that very moment, become
   * bookings like any other. Releasing a hold asks Stripe: one it can't
   * answer now stops the deletion.
   */
  async releaseHoldsOfAccount(userId: string): Promise<void> {
    for (const column of ['particulier_id', 'coiffeur_id'] as const) {
      for (const row of await this.rowsWithStatus(column, userId, ['awaiting_payment'])) {
        await this.releaseRow(row);
      }
    }
  }

  /**
   * An account being deleted: every booking still to come is cancelled and
   * refunded in full, the other side told — a salon's all of them; a
   * client's the ones they could still cancel themselves. One past the
   * salon's deadline stays, owed to the salon as if the client had stayed,
   * and is anonymized with the account like those already started.
   */
  async cancelUpcomingOf(userId: string, now = new Date()): Promise<void> {
    for (const column of ['particulier_id', 'coiffeur_id'] as const) {
      const side = column === 'particulier_id' ? 'client' : 'salon';
      const rows = [
        ...(await this.rowsWithStatus(column, userId, ['pending'])),
        ...(await this.rowsWithStatus(column, userId, ['confirmed'], now)),
      ];
      const notices = side === 'client' ? await this.salonsFor([...new Set(rows.map(salonOf))]) : null;
      for (const row of rows) {
        const until = notices ? modifiableUntil(row, notices.get(salonOf(row))?.cancellationNoticeMinutes ?? 0) : null;
        if (until !== null && new Date(until).getTime() <= now.getTime()) continue;
        await this.cancelForDeletion(row, side, userId);
      }
    }
  }

  /** What a client wrote to salons goes with them; the bookings themselves stay, anonymized. */
  async forgetClientNotes(particulierId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('appointments')
      .update({ client_note: null })
      .eq('particulier_id', particulierId);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  private async cancelForDeletion(row: AppointmentRow, side: 'client' | 'salon', userId: string): Promise<void> {
    try {
      await this.updateWhileStatus(row.id, ['pending', 'confirmed'], { status: 'cancelled', cancelled_by: side }, 'Changed meanwhile');
    } catch (err) {
      // Cancelled or refused meanwhile, by the other side: nothing left to do.
      if (err instanceof BadRequestException) return;
      throw err;
    }
    await this.refundAfter(row.id, side === 'client' ? 'client_cancelled' : 'salon_cancelled');
    this.events.emit('appointment.cancelled', {
      appointmentId: row.id,
      coiffeurId: salonOf(row),
      particulierId: clientOf(row),
      staffId: row.status === 'confirmed' ? (row.staff_id ?? null) : null,
      cancelledByUserId: userId,
      serviceName: row.service_name,
      startsAt: row.starts_at,
    });
  }

  /** This side's bookings in these statuses — starting from `from` on, when given — however many. */
  private async rowsWithStatus(
    column: 'particulier_id' | 'coiffeur_id',
    userId: string,
    statuses: string[],
    from?: Date,
  ): Promise<AppointmentRow[]> {
    return allPages<AppointmentRow>((first, last) => {
      let query = this.supabase.client.from('appointments').select().eq(column, userId).in('status', statuses);
      if (from) query = query.gte('starts_at', from.toISOString());
      return query.order('starts_at').order('id').range(first, last);
    });
  }

  // ─── Admin: disputes ─────────────────────────────────────────────────────

  /**
   * WorldHair cancels a booking to settle a dispute (TODO.md Phase 7): a
   * request or an accepted booking, even one already over, with a reason
   * both sides are told. Everything the client paid and hasn't had back
   * goes back — once the salon was paid, its share is taken back from its
   * transfer first. The cancellation stands even when Stripe can't refund
   * right now: `refundFailed` says so, and the admin refunds from the
   * booking's page (the job also would, before the payout).
   */
  async cancelByAdmin(id: string, reason: string): Promise<{ refunded: number; refundFailed: boolean }> {
    const row = await this.rowOrThrow(id);
    const why = reason.trim();
    await this.updateWhileStatus(
      id,
      ['pending', 'confirmed'],
      { status: 'cancelled', cancelled_by: 'admin', cancellation_reason: why },
      'Only a request or an accepted booking can be cancelled',
    );
    let refunded = 0;
    let refundFailed = false;
    try {
      refunded = await this.payments.refund(id, { reason: 'admin' });
    } catch (err) {
      refundFailed = true;
      this.logger.error(`Refund for appointment ${id}, cancelled by an admin, failed`, err as Error);
    }
    this.events.emit('appointment.cancelled_by_admin', {
      appointmentId: id,
      particulierId: row.particulier_id,
      coiffeurId: row.coiffeur_id,
      staffId: row.status === 'confirmed' ? (row.staff_id ?? null) : null,
      serviceName: row.service_name,
      startsAt: row.starts_at,
      reason: why,
      refunded,
    });
    return { refunded, refundFailed };
  }

  // ─── Slots ───────────────────────────────────────────────────────────────

  /**
   * Which starts are already spoken for at this salon — no client identity.
   * Superseded by `slots()` for the booking grid; kept for app versions that
   * still build the grid themselves.
   */
  async listBusySlots(coiffeurId: string): Promise<{ startsAt: string; durationMin: number }[]> {
    return (await this.activeRowsWhere('coiffeur_id', coiffeurId)).map(toBusy);
  }

  /**
   * The booking grid for one day: every half-hour start, free or not, for a
   * new booking of `serviceIds` or for moving `appointmentId`. The coiffeur
   * moving their own appointment isn't held to the booking notice.
   */
  async slots(callerId: string, callerRole: Role, coiffeurId: string, query: SlotsQuery): Promise<DaySlots> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query.date)) {
      throw new BadRequestException('date must be YYYY-MM-DD');
    }
    const profile = await this.bookableSalon(coiffeurId);

    let durationMin: number;
    let particulierId: string | undefined;
    let excludeAppointmentId: string | undefined;
    let ignoreHoldsOf: string | undefined;
    let bookingNoticeMinutes = profile.bookingNoticeMinutes;
    const members: Members = 'bookable';
    let alsoStaffId: string | null | undefined;

    if (query.appointmentId) {
      const row = await this.rowOrThrow(query.appointmentId);
      if (row.coiffeur_id !== coiffeurId || (row.particulier_id !== callerId && row.coiffeur_id !== callerId)) {
        throw new ForbiddenException();
      }
      durationMin = row.duration_min;
      particulierId = row.particulier_id ?? undefined;
      excludeAppointmentId = row.id;
      alsoStaffId = row.staff_id;
      if (callerId === row.coiffeur_id) bookingNoticeMinutes = 0;
    } else if (query.serviceIds && query.serviceIds.length > 0) {
      const services = await this.salon.listServices(coiffeurId, { activeOnly: true });
      durationMin = query.serviceIds.reduce((sum, id) => {
        const service = services.find((item) => item.id === id);
        if (!service) {
          throw new NotFoundException('Service not found');
        }
        return sum + service.durationMin;
      }, 0);
      particulierId = callerRole === 'particulier' ? callerId : undefined;
      // Booking again replaces the client's unpaid hold (see create): it isn't in their way.
      ignoreHoldsOf = particulierId;
    } else {
      throw new BadRequestException('Pick at least one service');
    }

    const team = await this.teamRulesFor(coiffeurId, {
      particulierId,
      excludeAppointmentId,
      ignoreHoldsOf,
      bookingNoticeMinutes,
      members,
      alsoStaffId,
    });
    return slotsForTeam(team, query.date, durationMin);
  }

  // ─── Coiffeur: list / decide / move / attendance ─────────────────────────

  async listForCoiffeur(coiffeurId: string): Promise<CoiffeurAppointment[]> {
    // A slot held while its client pays reaches the salon only once paid.
    const rows = (await this.rowsWhere('coiffeur_id', coiffeurId, WITH_LINES))
      .filter((row) => row.status !== 'awaiting_payment')
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    return this.mapForSalon(rows, await this.staff.team(coiffeurId), true);
  }

  /**
   * A staff member's own agenda (TODO.md Phase 3): the accepted bookings
   * they do, read-only — no payments, the owner deals with the money.
   */
  async listForStaff(profileId: string): Promise<CoiffeurAppointment[]> {
    const membership = await this.staff.membershipOf(profileId);
    if (!membership) return [];
    const rows = (
      await allPages<AppointmentRow>((from, to) =>
        this.supabase.client
          .from('appointments')
          .select(WITH_LINES)
          .eq('staff_id', membership.staffId)
          // Theirs once accepted: a request is only held on them, the owner may give it to someone else.
          .eq('status', 'confirmed')
          .order('starts_at')
          .order('id')
          .range(from, to),
      )
    ).sort((a, b) => a.created_at.localeCompare(b.created_at));
    return this.mapForSalon(rows, await this.staff.team(membership.salonId), false);
  }

  private async mapForSalon(rows: AppointmentRow[], team: StaffMember[], withPayments: boolean): Promise<CoiffeurAppointment[]> {
    const names = await this.particulierNamesFor([...new Set(rows.flatMap((row) => (row.particulier_id ? [row.particulier_id] : [])))]);
    const staffNames = new Map(team.map((member) => [member.id, `${member.firstName} ${member.lastName}`.trim()]));

    const seen = new Set<string>();
    const now = new Date();
    const mapped = rows.map((row) => {
      const staffName = row.staff_id ? (staffNames.get(row.staff_id) ?? null) : null;
      let item: CoiffeurAppointment;
      if (!row.particulier_id) {
        item = this.mapCoiffeur(row, DELETED_CLIENT, false, now, staffName);
      } else {
        const isNewClient = !seen.has(row.particulier_id);
        seen.add(row.particulier_id);
        item = this.mapCoiffeur(row, names.get(row.particulier_id) ?? 'Client', isNewClient, now, staffName);
      }
      return withPayments ? item : { ...item, payment: null };
    });
    return mapped.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  /**
   * Accepts or refuses a request. Accepting gives it to someone free then
   * (TODO.md Phase 3): `staffId`, the owner's pick in « Qui s'en occupe ? »,
   * or the person held when the client booked.
   */
  async decide(coiffeurId: string, id: string, decision: 'confirmed' | 'refused', staffId?: string): Promise<void> {
    const row = await this.rowOrThrow(id);
    if (row.coiffeur_id !== coiffeurId) {
      throw new ForbiddenException();
    }
    if (row.status !== 'pending') {
      throw new BadRequestException('This request has already been decided');
    }
    if (new Date(row.starts_at).getTime() < Date.now()) {
      throw new BadRequestException('This request has expired');
    }
    const patch: Record<string, unknown> = { status: decision };
    if (decision === 'confirmed') {
      patch.staff_id = await this.freePersonFor(row, staffId ?? row.staff_id ?? null);
    }
    // Only while still pending: the client may have cancelled it, or the job expired it, meanwhile.
    await this.updateWhileStatus(id, ['pending'], patch, 'This request has already been decided');
    if (decision === 'refused') {
      await this.refundAfter(id, 'salon_refused');
    }
    this.events.emit(decision === 'confirmed' ? 'appointment.confirmed' : 'appointment.refused', {
      appointmentId: id,
      particulierId: row.particulier_id,
      serviceName: row.service_name,
      startsAt: row.starts_at,
    });
    if (decision === 'confirmed') {
      this.emitAssigned({ ...row, staff_id: patch.staff_id as string });
    }
  }

  /**
   * « Qui s'en occupe ? » (TODO.md Phase 3): the salon's team in order, each
   * free or not at this booking's time, and the person it has now.
   */
  async candidates(coiffeurId: string, id: string): Promise<StaffCandidate[]> {
    const row = await this.rowOrThrow(id);
    if (row.coiffeur_id !== coiffeurId) {
      throw new ForbiddenException();
    }
    const [team, rules] = await Promise.all([
      this.staff.team(coiffeurId),
      this.teamRulesFor(coiffeurId, {
        particulierId: row.particulier_id ?? undefined,
        excludeAppointmentId: row.id,
        bookingNoticeMinutes: 0,
        members: 'all',
      }),
    ]);
    const startsAt = new Date(row.starts_at);
    return team.map((member) => {
      const person = rules.find((candidate) => candidate.staffId === member.id);
      const refusal = person ? refusalFor(person.rules, startsAt, row.duration_min) : 'staff_off';
      return {
        staffId: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        photoUrl: member.photoUrl,
        isOwner: member.isOwner,
        free: refusal === null || refusal === 'past',
        held: member.id === row.staff_id,
      };
    });
  }

  /** Gives a booking to someone else of the team, free at its time — a request or an accepted one, before it starts. */
  async assign(coiffeurId: string, id: string, staffId: string): Promise<void> {
    const row = await this.rowOrThrow(id);
    if (row.coiffeur_id !== coiffeurId) {
      throw new ForbiddenException();
    }
    if (row.status !== 'pending' && row.status !== 'confirmed') {
      throw new BadRequestException('This appointment can no longer be modified');
    }
    if (new Date(row.starts_at).getTime() <= Date.now()) {
      throw new BadRequestException('This appointment has already started');
    }
    if (row.staff_id === staffId) return;
    const person = await this.freePersonFor(row, staffId);
    await this.updateWhileStatus(id, ['pending', 'confirmed'], { staff_id: person }, 'This appointment can no longer be modified');
    // A request is only held: the person hears of it once it's accepted.
    if (row.status === 'confirmed') this.emitAssigned({ ...row, staff_id: person });
  }

  /**
   * "Déplacer": an accepted appointment only — a pending request is accepted
   * or refused instead. It stays with its person when they're free then;
   * otherwise it goes to `staffId`, or to someone else free.
   */
  async move(coiffeurId: string, id: string, startsAtIso: string, staffId?: string): Promise<void> {
    const row = await this.rowOrThrow(id);
    if (row.coiffeur_id !== coiffeurId) {
      throw new ForbiddenException();
    }
    if (row.status !== 'confirmed') {
      throw new BadRequestException('Only an accepted appointment can be moved');
    }
    this.assertNotPast(row);
    if (new Date(row.starts_at).getTime() <= Date.now()) {
      throw new BadRequestException('This appointment has already started');
    }

    const startsAt = this.parseDate(startsAtIso);
    // Someone the owner names may be anyone of the team; otherwise only those
    // who take clients' bookings, and the person it has.
    const team = await this.teamRulesFor(coiffeurId, {
      particulierId: row.particulier_id ?? undefined,
      excludeAppointmentId: id,
      bookingNoticeMinutes: 0,
      members: staffId ? 'all' : 'bookable',
      alsoStaffId: row.staff_id,
    });
    let person: PersonRules | null;
    if (staffId) {
      person = team.find((candidate) => candidate.staffId === staffId) ?? null;
      if (!person) {
        throw new NotFoundException('Staff member not found');
      }
      this.assertTeamSlot([person], startsAt, row.duration_min, 'salon');
    } else {
      this.assertTeamSlot(team, startsAt, row.duration_min, 'salon');
      person = pickPerson(team, startsAt, row.duration_min, row.staff_id);
    }

    // The client never chose this time: they may change it until it starts (see modifiableUntil).
    const updated = await this.updateRow(id, {
      starts_at: startsAt.toISOString(),
      staff_id: person!.staffId,
      moved_by_salon: true,
    });
    this.events.emit('appointment.moved', {
      appointmentId: id,
      particulierId: row.particulier_id,
      // A booking given to someone else: they hear of it as theirs (emitAssigned), not as moved.
      staffId: person!.staffId === row.staff_id ? person!.staffId : null,
      serviceName: row.service_name,
      previousStartsAt: row.starts_at,
      startsAt: updated.starts_at,
    });
    if (person!.staffId !== row.staff_id) this.emitAssigned(updated);
  }

  /**
   * "Marquer comme honoré" — or missed. No review can be left after a
   * no-show, and a no-show can't follow a review: marking one must never be a
   * way for a salon to remove what a client wrote (reporting it is).
   */
  async setAttendance(actorId: string, id: string, attendance: Attendance): Promise<void> {
    const row = await this.rowOrThrow(id);
    // The salon's owner, or the staff member doing it (TODO.md Phase 3).
    if (row.coiffeur_id !== actorId) {
      const membership = await this.staff.membershipOf(actorId);
      if (!membership || !row.staff_id || membership.staffId !== row.staff_id) {
        throw new ForbiddenException();
      }
    }
    if (row.status !== 'confirmed') {
      throw new BadRequestException('Only an accepted appointment can be marked');
    }
    if (new Date(row.starts_at).getTime() > Date.now()) {
      throw new BadRequestException("This appointment hasn't started yet");
    }
    if (attendance === 'no_show' && (await this.hasReview(id))) {
      throw new BadRequestException('The client already left a review for this appointment');
    }
    await this.updateRow(id, { attendance });
  }

  // ─── Shared helpers ──────────────────────────────────────────────────────

  private parseDate(iso: string): Date {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(REFUSAL_MESSAGES.past);
    }
    return date;
  }

  private assertStillActive(row: AppointmentRow): void {
    if (!isActive(row)) {
      throw new BadRequestException('This appointment can no longer be modified');
    }
  }

  /** A booking that already happened is history: cancelling or moving it would also block its review. */
  private assertNotPast(row: AppointmentRow): void {
    if (derivedStatus(row) === 'done') {
      throw new BadRequestException('This appointment has already taken place');
    }
  }

  private assertBeforeDeadline(row: AppointmentRow, salonNoticeMinutes: number): void {
    const until = modifiableUntil(row, salonNoticeMinutes);
    if (until === null || Date.now() > new Date(until).getTime()) {
      throw new BadRequestException("Too late: the salon's cancellation deadline has passed");
    }
  }

  /** Validated, shop-complete, subscribed and not suspended/banned — anything else can't be booked (or even seen). */
  private async bookableSalon(coiffeurId: string): Promise<SalonProfile> {
    const [application, profile, accountActive, listed] = await Promise.all([
      this.applications.getMine(coiffeurId),
      this.salon.getProfile(coiffeurId),
      isAccountActive(this.supabase, coiffeurId),
      isSalonListed(this.supabase, coiffeurId),
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
    return profile;
  }

  /**
   * The booking rules for each person who can take it (TODO.md Phase 3): the
   * salon's hours, closures and subscription for all, then each one's own
   * week, congés and bookings. A booking without a person (seeded, or from
   * before teams) counts as the owner's, as the migration made them.
   */
  private async teamRulesFor(coiffeurId: string, options: TeamRulesOptions): Promise<PersonRules[]> {
    const [availability, closures, salonRows, clientRows, subscription, team] = await Promise.all([
      this.salon.getAvailability(coiffeurId),
      this.salon.listTimeOff(coiffeurId),
      this.activeRowsWhere('coiffeur_id', coiffeurId),
      options.particulierId ? this.activeRowsWhere('particulier_id', options.particulierId) : Promise.resolve([]),
      findSalonSubscription(this.supabase, coiffeurId),
      this.staff.team(coiffeurId),
    ]);
    const counts = (row: AppointmentRow) =>
      holdsSlot(row) &&
      row.id !== options.excludeAppointmentId &&
      !(row.status === 'awaiting_payment' && row.particulier_id === options.ignoreHoldsOf);
    const ownerId = team.find((member) => member.isOwner)?.id;
    const active = salonRows.filter(counts);
    const ends = closedAfter(subscriptionEndsAt(subscription));
    // The client can't be in two chairs at once, here or anywhere.
    const clientBookings = clientRows.filter(counts).map(toBusy);
    const now = new Date();

    return team
      .filter((member) => options.members === 'all' || member.takesBookings || member.id === options.alsoStaffId)
      .map((member) => ({
        staffId: member.id,
        position: member.position,
        rules: {
          availability,
          personalAvailability: member.availability,
          closures: [
            ...closures
              .filter((closure) => closure.staffId === null || closure.staffId === member.id)
              .map(({ startsAt, endsAt }) => ({ startsAt, endsAt })),
            ...ends,
          ],
          salonBookings: active.filter((row) => (row.staff_id ?? ownerId) === member.id).map(toBusy),
          clientBookings,
          bookingNoticeMinutes: options.bookingNoticeMinutes,
          now,
        },
      }));
  }

  private assertTeamSlot(team: PersonRules[], startsAt: Date, durationMin: number, audience: 'client' | 'salon'): void {
    const refusal = teamRefusal(team, startsAt, durationMin);
    if (refusal === null) return;
    if (refusal === 'client_busy' && audience === 'salon') {
      throw new BadRequestException('The client already has an appointment at that time');
    }
    throw new BadRequestException(REFUSAL_MESSAGES[refusal]);
  }

  /**
   * Inserts the booking on a free person: the one pickPerson() holds, then —
   * when another request took them in the meantime (the exclusion
   * constraint) — the next one free, until nobody is.
   */
  private async insertOnFreePerson(
    team: PersonRules[],
    startsAt: Date,
    durationMin: number,
    row: Record<string, unknown>,
  ): Promise<AppointmentRow> {
    let remaining = team;
    for (;;) {
      const person = pickPerson(remaining, startsAt, durationMin);
      if (!person) {
        throw new BadRequestException(REFUSAL_MESSAGES.taken);
      }
      const { data, error } = await this.supabase.client
        .from('appointments')
        .insert({ ...row, staff_id: person.staffId })
        .select()
        .single();
      if (!error) return data as AppointmentRow;
      // Two requests for the same time can both pass the check above; the
      // database's exclusion constraint lets only one of them have this person.
      if (error.code !== '23P01') {
        throw new InternalServerErrorException(error.message);
      }
      remaining = remaining.filter((candidate) => candidate.staffId !== person.staffId);
    }
  }

  /**
   * `staffId` — a member of the booking's salon, free at its time — or why
   * not. The owner's own choice: no notice, anyone in the team; none named
   * means the owner, as a booking without a person always was. The person a
   * booking already has only needs not to be taken meanwhile: accepting it
   * stays as before teams (a closure or new hours since don't block it).
   */
  private async freePersonFor(row: AppointmentRow, staffId: string | null): Promise<string> {
    const salonId = salonOf(row);
    const team = await this.teamRulesFor(salonId, {
      particulierId: row.particulier_id ?? undefined,
      excludeAppointmentId: row.id,
      bookingNoticeMinutes: 0,
      members: 'all',
    });
    const target = staffId ?? (await this.staff.team(salonId)).find((member) => member.isOwner)?.id ?? null;
    const person = team.find((candidate) => candidate.staffId === target);
    if (!person) {
      throw new NotFoundException('Staff member not found');
    }
    const refusal = refusalFor(person.rules, new Date(row.starts_at), row.duration_min);
    const blocking = target === row.staff_id ? refusal === 'taken' : refusal !== null && refusal !== 'past';
    if (blocking) {
      throw new BadRequestException(NOT_FREE);
    }
    return person.staffId;
  }

  /** A booking given to someone: they hear of it (notifications/listeners). */
  private emitAssigned(row: AppointmentRow): void {
    if (!row.staff_id || !row.coiffeur_id) return;
    this.events.emit('appointment.assigned', {
      appointmentId: row.id,
      salonId: row.coiffeur_id,
      staffId: row.staff_id,
      serviceName: row.service_name,
      startsAt: row.starts_at,
    });
  }

  /** Every booking of this side, however many: page after page (PostgREST answers 1 000 rows at most). */
  private async rowsWhere(
    column: 'particulier_id' | 'coiffeur_id',
    value: string,
    columns = '*',
  ): Promise<AppointmentRow[]> {
    return allPages<AppointmentRow>((from, to) =>
      this.supabase.client
        .from('appointments')
        .select(columns)
        .eq(column, value)
        .order('starts_at')
        .order('id')
        .range(from, to),
    );
  }

  /**
   * Pending and confirmed bookings not over yet — all a new start can collide
   * with. Filtered in the query, since a salon's whole history would outgrow
   * PostgREST's 1 000-row cap and hide recent bookings. A booking fits inside
   * one day's opening hours, so none that started over a day ago still runs.
   */
  private async activeRowsWhere(column: 'particulier_id' | 'coiffeur_id', value: string): Promise<AppointmentRow[]> {
    const { data, error } = await this.supabase.client
      .from('appointments')
      .select()
      .eq(column, value)
      .in('status', ['awaiting_payment', 'pending', 'confirmed'])
      .gte('starts_at', new Date(Date.now() - DAY_MS).toISOString());
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data as unknown as AppointmentRow[];
  }

  private async hasReview(appointmentId: string): Promise<boolean> {
    const { data, error } = await this.supabase.client
      .from('reviews')
      .select('id')
      .eq('appointment_id', appointmentId)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data !== null;
  }

  private async findRow(id: string): Promise<AppointmentRow | null> {
    const { data, error } = await this.supabase.client
      .from('appointments')
      .select(WITH_LINES)
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data as unknown as AppointmentRow | null;
  }

  /** Where Stripe emails the payment receipt. */
  private async emailOf(profileId: string): Promise<string | null> {
    const {
      data: { user },
      error,
    } = await this.supabase.client.auth.admin.getUserById(profileId);
    return error ? null : (user?.email ?? null);
  }

  private async rowOrThrow(id: string): Promise<AppointmentRow> {
    const { data, error } = await this.supabase.client
      .from('appointments')
      .select(WITH_LINES)
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException('Appointment not found');
    }
    return data as unknown as AppointmentRow;
  }

  private async updateRow(id: string, patch: Record<string, unknown>): Promise<AppointmentRow> {
    const { data, error } = await this.supabase.client
      .from('appointments')
      .update(patch)
      .eq('id', id)
      .select(WITH_LINES)
      .single();
    if (error) {
      if (error.code === '23P01') {
        throw new BadRequestException(REFUSAL_MESSAGES.taken);
      }
      throw new InternalServerErrorException(error.message);
    }
    return data as unknown as AppointmentRow;
  }

  /** A status change that only lands while the row is still in one of `from`: another request may have got there first. */
  private async updateWhileStatus(id: string, from: string[], patch: Record<string, unknown>, refusal: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('appointments')
      .update(patch)
      .eq('id', id)
      .in('status', from)
      .select()
      .maybeSingle();
    if (error) {
      // Someone else got that person at that time first.
      if (error.code === '23P01') {
        throw new BadRequestException(NOT_FREE);
      }
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new BadRequestException(refusal);
    }
  }

  /** A hundred at a time: a client's salons, however many. */
  private async salonsFor(
    coiffeurIds: string[],
  ): Promise<Map<string, { name: string; cancellationNoticeMinutes: number }>> {
    const salons = new Map<string, { name: string; cancellationNoticeMinutes: number }>();
    for (const slice of slices(coiffeurIds)) {
      const { data, error } = await this.supabase.client.from('coiffeur_profiles').select().in('profile_id', slice);
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
      for (const row of data as { profile_id: string; salon_name: string; cancellation_notice_minutes: number }[]) {
        salons.set(row.profile_id, { name: row.salon_name, cancellationNoticeMinutes: row.cancellation_notice_minutes ?? 0 });
      }
    }
    return salons;
  }

  /** A hundred at a time: a busy salon's clients, however many. */
  private async particulierNamesFor(ids: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    for (const slice of slices(ids)) {
      const { data, error } = await this.supabase.client.from('profiles').select().in('id', slice);
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
      for (const row of data as { id: string; first_name: string; last_name: string }[]) {
        names.set(row.id, `${row.first_name} ${row.last_name}`.trim() || 'Client');
      }
    }
    return names;
  }

  private mapParticulier(
    row: AppointmentRow,
    salonName: string,
    cancellationNoticeMinutes: number,
    now = new Date(),
    lines: AppointmentLine[] = linesOf(row),
  ): ParticulierAppointment {
    return {
      id: row.id,
      salonId: row.coiffeur_id,
      salonName,
      serviceId: row.service_id,
      serviceName: row.service_name,
      startsAt: row.starts_at,
      durationMin: row.duration_min,
      price: Number(row.price),
      services: lines,
      status: derivedStatus(row, now),
      attendance: (row.attendance as Attendance | null | undefined) ?? null,
      modifiableUntil: row.coiffeur_id ? modifiableUntil(row, cancellationNoticeMinutes) : null,
      movedBySalon: row.moved_by_salon ?? false,
      payment: clientPayment(row),
      cancelledBy: row.cancelled_by ?? null,
      cancellationReason: row.cancellation_reason ?? null,
      confirmedByClientAt: row.confirmed_by_client_at ?? null,
      createdAt: row.created_at,
    };
  }

  private mapCoiffeur(
    row: AppointmentRow,
    clientName: string,
    isNewClient: boolean,
    now = new Date(),
    staffName: string | null = null,
  ): CoiffeurAppointment {
    return {
      id: row.id,
      serviceId: row.service_id,
      clientId: row.particulier_id,
      clientName,
      startsAt: row.starts_at,
      durationMin: row.duration_min,
      price: Number(row.price),
      services: linesOf(row),
      status: derivedStatus(row, now),
      attendance: (row.attendance as Attendance | null | undefined) ?? null,
      note: row.client_note ?? undefined,
      isNewClient,
      payment: salonPayment(row),
      cancelledBy: row.cancelled_by ?? null,
      cancellationReason: row.cancellation_reason ?? null,
      confirmedByClientAt: row.confirmed_by_client_at ?? null,
      staffId: row.staff_id ?? null,
      staffName,
    };
  }
}
