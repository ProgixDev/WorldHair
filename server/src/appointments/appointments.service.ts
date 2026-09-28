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
import { findSalonSubscription, isSalonListed } from '../common/utils/subscription-status';
import { subscriptionEndsAt } from '../subscriptions/subscription-state';
import { SupabaseService } from '../database/supabase.service';
import { PaymentRow, PaymentsService } from '../payments/payments.service';
import { PayoutAccountsService } from '../payments/payout-accounts.service';
import { SalonProfile, SalonService, SalonServiceItem } from '../salon/salon.service';
import { BookingRules, BusyBooking, DaySlots, refusalFor, SlotRefusal, slotsForDay } from './booking-rules';

/**
 * "done" is NOT a stored status (see schema.sql's appointments table) — it's
 * derived here, at read time, from "confirmed AND already past". No cron or
 * background job transitions it; nothing in the product ever needs to act on
 * the transition itself, only ever read the resulting label.
 */
export type AppointmentStatus = 'awaiting_payment' | 'pending' | 'confirmed' | 'refused' | 'cancelled' | 'done';

/** Set by the coiffeur once an accepted appointment has started; `null` until then. */
export type Attendance = 'attended' | 'no_show';

/** One prestation of a booking — a snapshot, so editing or deleting the service later never changes what was booked. */
export interface AppointmentLine {
  serviceId: string | null;
  name: string;
  price: number;
  durationMin: number;
}

export interface ParticulierAppointment {
  id: string;
  salonId: string;
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

/** POST /appointments: the held booking, and what the app's Stripe payment sheet needs to charge it. */
export interface HeldAppointment {
  appointment: ParticulierAppointment;
  payment: { clientSecret: string; amount: number };
}

export interface CoiffeurAppointment {
  id: string;
  serviceId: string | null;
  clientId: string;
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
  particulier_id: string;
  coiffeur_id: string;
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
  created_at: string;
  /** Embedded by `select(WITH_LINES)`. */
  appointment_services?: AppointmentServiceRow[];
  /** Embedded by `select(WITH_LINES)` — one-to-one, so an object (a list from older PostgREST). */
  payments?: PaymentRow | PaymentRow[] | null;
}

/** An appointment row with its prestations and its payment embedded — one round-trip, whatever the number of bookings. */
const WITH_LINES = '*, appointment_services(*), payments(*)';

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
};

function endTimeMs(row: { starts_at: string; duration_min: number }): number {
  return new Date(row.starts_at).getTime() + row.duration_min * MINUTE_MS;
}

/** Exported for ReviewsService — a review may only be left once its appointment shows as "done". */
export function derivedStatus(row: AppointmentRow, now: Date = new Date()): AppointmentStatus {
  if (row.status === 'confirmed' && endTimeMs(row) < now.getTime()) return 'done';
  return row.status as AppointmentStatus;
}

function isActive(row: AppointmentRow): boolean {
  return row.status === 'pending' || row.status === 'confirmed';
}

/** A booking, or a slot held while its client pays: either keeps the time from anyone else. */
function holdsSlot(row: AppointmentRow): boolean {
  return isActive(row) || row.status === 'awaiting_payment';
}

const round2 = (euros: number) => Math.round(euros * 100) / 100;

function paymentOf(row: AppointmentRow): PaymentRow | null {
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
    payoutAmount: paidOut ? Number(payment.transfer_amount) : round2(kept - commission),
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
function linesOf(row: AppointmentRow): AppointmentLine[] {
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
  ) {}

  // ─── Create (particulier) ────────────────────────────────────────────────

  /**
   * Holds the slot and asks Stripe to charge the total (TODO.md Phase 5): the
   * app's payment sheet pays it, and only then does the salon get the
   * request (`completePayment`, or Stripe's webhook). An unpaid hold is
   * released after PAYMENT_HOLD_MS.
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
    const services = await this.salon.listServices(input.coiffeurId);
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
    const rules = await this.rulesFor(input.coiffeurId, {
      particulierId,
      bookingNoticeMinutes: profile.bookingNoticeMinutes,
    });
    this.assertSlot(rules, startsAt, durationMin, 'client');

    const { data, error } = await this.supabase.client
      .from('appointments')
      .insert({
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
      })
      .select()
      .single();
    if (error) {
      // Two requests for the same time can both pass the check above; the
      // database's exclusion constraint lets only one of them in.
      if (error.code === '23P01') {
        throw new BadRequestException(REFUSAL_MESSAGES.taken);
      }
      throw new InternalServerErrorException(error.message);
    }
    const created = data as AppointmentRow;

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

    let clientSecret: string;
    try {
      ({ clientSecret } = await this.payments.startPayment({
        appointmentId: created.id,
        particulierId,
        coiffeurId: input.coiffeurId,
        amount: price,
        description: `WorldHair — ${profile.salonName} — ${serviceName}`,
        email: await this.emailOf(particulierId),
      }));
    } catch (err) {
      await this.supabase.client.from('appointments').delete().eq('id', created.id);
      throw err;
    }

    return {
      appointment: this.mapParticulier(created, profile.salonName, profile.cancellationNoticeMinutes, new Date(), lines),
      payment: { clientSecret, amount: price },
    };
  }

  // ─── Payment (particulier, Stripe) ───────────────────────────────────────

  /** "I've paid": Stripe is asked directly, so the request goes out without waiting for its webhook. */
  async completePayment(particulierId: string, id: string): Promise<ParticulierAppointment> {
    let row = await this.rowOrThrow(id);
    if (row.particulier_id !== particulierId) {
      throw new ForbiddenException();
    }
    if (row.status === 'awaiting_payment') {
      const payment = await this.payments.findByAppointment(id);
      if (payment) {
        const intent = await this.payments.retrieveIntent(payment);
        if (intent.status === 'succeeded') row = await this.finalizePayment(row, payment, intent);
      }
    }
    const profile = await this.salon.getProfile(row.coiffeur_id);
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
        .update({ status: 'cancelled' })
        .eq('id', row.id)
        .eq('status', 'pending')
        .select()
        .maybeSingle();
      if (updateError || !expired) continue;
      await this.payments.refund(row.id, { reason: 'request_expired' });
      this.events.emit('appointment.expired', {
        appointmentId: row.id,
        particulierId: row.particulier_id,
        coiffeurId: row.coiffeur_id,
        serviceName: row.service_name,
        startsAt: row.starts_at,
      });
    }
  }

  /** Stripe's payment events (webhook). */
  async handlePaymentEvent(event: Stripe.Event): Promise<void> {
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object;
      const payment = await this.payments.findByIntent(intent.id);
      if (!payment) {
        // One of ours (it names an appointment) whose hold is already gone: nothing was booked.
        if (intent.metadata?.appointment_id) await this.payments.refundOrphan(intent);
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
    if (payment.status !== 'succeeded') await this.payments.markSucceeded(payment, intent);
    if (row.status !== 'awaiting_payment') return row;

    const profile = await this.salon.getProfile(row.coiffeur_id);
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
    }
    return updated;
  }

  private async releaseRow(row: AppointmentRow): Promise<void> {
    if (row.status !== 'awaiting_payment') return;
    const payment = await this.payments.findByAppointment(row.id);
    if (payment) {
      const outcome = await this.payments.cancelIntent(payment);
      if (outcome === 'succeeded') {
        await this.finalizePayment(row, payment, await this.payments.retrieveIntent(payment));
        return;
      }
      // Still going through the bank: the hold stays until Stripe says.
      if (outcome === 'processing') return;
    }
    await this.supabase.client.from('appointments').delete().eq('id', row.id).eq('status', 'awaiting_payment');
  }

  // ─── Particulier: list / reschedule / cancel ────────────────────────────

  async listForParticulier(particulierId: string): Promise<ParticulierAppointment[]> {
    // A slot held for an unfinished payment isn't a booking yet.
    const rows = (await this.rowsWhere('particulier_id', particulierId, WITH_LINES)).filter(
      (row) => row.status !== 'awaiting_payment',
    );
    const salons = await this.salonsFor([...new Set(rows.map((row) => row.coiffeur_id))]);
    const now = new Date();
    return rows
      .map((row) => {
        const salon = salons.get(row.coiffeur_id);
        return this.mapParticulier(row, salon?.name ?? '', salon?.cancellationNoticeMinutes ?? 0, now);
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
    const profile = await this.salon.getProfile(row.coiffeur_id);
    this.assertBeforeDeadline(row, profile.cancellationNoticeMinutes);

    const startsAt = this.parseDate(startsAtIso);
    const rules = await this.rulesFor(row.coiffeur_id, {
      particulierId,
      excludeAppointmentId: id,
      bookingNoticeMinutes: profile.bookingNoticeMinutes,
    });
    this.assertSlot(rules, startsAt, row.duration_min, 'client');

    // The client picked this time themselves: the salon's notice binds it again.
    const updated = await this.updateRow(id, { starts_at: startsAt.toISOString(), moved_by_salon: false });
    this.events.emit('appointment.rescheduled', {
      appointmentId: id,
      coiffeurId: row.coiffeur_id,
      serviceName: row.service_name,
      previousStartsAt: row.starts_at,
      startsAt: updated.starts_at,
    });
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
      const profile = await this.salon.getProfile(row.coiffeur_id);
      this.assertBeforeDeadline(row, profile.cancellationNoticeMinutes);
    }
    await this.updateRow(id, { status: 'cancelled' });
    // In time (the client) or not their fault (the salon): the client gets everything back.
    await this.payments.refund(id, {
      reason: currentUserId === row.particulier_id ? 'client_cancelled' : 'salon_cancelled',
    });
    this.events.emit('appointment.cancelled', {
      appointmentId: id,
      coiffeurId: row.coiffeur_id,
      particulierId: row.particulier_id,
      cancelledByUserId: currentUserId,
      serviceName: row.service_name,
      startsAt: row.starts_at,
    });
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
    let bookingNoticeMinutes = profile.bookingNoticeMinutes;

    if (query.appointmentId) {
      const row = await this.rowOrThrow(query.appointmentId);
      if (row.coiffeur_id !== coiffeurId || (row.particulier_id !== callerId && row.coiffeur_id !== callerId)) {
        throw new ForbiddenException();
      }
      durationMin = row.duration_min;
      particulierId = row.particulier_id;
      excludeAppointmentId = row.id;
      if (callerId === row.coiffeur_id) bookingNoticeMinutes = 0;
    } else if (query.serviceIds && query.serviceIds.length > 0) {
      const services = await this.salon.listServices(coiffeurId);
      durationMin = query.serviceIds.reduce((sum, id) => {
        const service = services.find((item) => item.id === id);
        if (!service) {
          throw new NotFoundException('Service not found');
        }
        return sum + service.durationMin;
      }, 0);
      particulierId = callerRole === 'particulier' ? callerId : undefined;
    } else {
      throw new BadRequestException('Pick at least one service');
    }

    const rules = await this.rulesFor(coiffeurId, { particulierId, excludeAppointmentId, bookingNoticeMinutes });
    return slotsForDay(rules, query.date, durationMin);
  }

  // ─── Coiffeur: list / decide / move / attendance ─────────────────────────

  async listForCoiffeur(coiffeurId: string): Promise<CoiffeurAppointment[]> {
    // A slot held while its client pays reaches the salon only once paid.
    const rows = (await this.rowsWhere('coiffeur_id', coiffeurId, WITH_LINES))
      .filter((row) => row.status !== 'awaiting_payment')
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
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
    if (new Date(row.starts_at).getTime() < Date.now()) {
      throw new BadRequestException('This request has expired');
    }
    await this.updateRow(id, { status: decision });
    if (decision === 'refused') {
      await this.payments.refund(id, { reason: 'salon_refused' });
    }
    this.events.emit(decision === 'confirmed' ? 'appointment.confirmed' : 'appointment.refused', {
      appointmentId: id,
      particulierId: row.particulier_id,
      serviceName: row.service_name,
      startsAt: row.starts_at,
    });
  }

  /** "Déplacer": an accepted appointment only — a pending request is accepted or refused instead. */
  async move(coiffeurId: string, id: string, startsAtIso: string): Promise<void> {
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
    const rules = await this.rulesFor(coiffeurId, {
      particulierId: row.particulier_id,
      excludeAppointmentId: id,
      bookingNoticeMinutes: 0,
    });
    this.assertSlot(rules, startsAt, row.duration_min, 'salon');

    // The client never chose this time: they may change it until it starts (see modifiableUntil).
    const updated = await this.updateRow(id, { starts_at: startsAt.toISOString(), moved_by_salon: true });
    this.events.emit('appointment.moved', {
      appointmentId: id,
      particulierId: row.particulier_id,
      serviceName: row.service_name,
      previousStartsAt: row.starts_at,
      startsAt: updated.starts_at,
    });
  }

  /**
   * "Marquer comme honoré" — or missed. No review can be left after a
   * no-show, and a no-show can't follow a review: marking one must never be a
   * way for a salon to remove what a client wrote (reporting it is).
   */
  async setAttendance(coiffeurId: string, id: string, attendance: Attendance): Promise<void> {
    const row = await this.rowOrThrow(id);
    if (row.coiffeur_id !== coiffeurId) {
      throw new ForbiddenException();
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

  private async rulesFor(
    coiffeurId: string,
    options: { particulierId?: string; excludeAppointmentId?: string; bookingNoticeMinutes: number },
  ): Promise<BookingRules> {
    const [availability, closures, salonRows, clientRows, subscription] = await Promise.all([
      this.salon.getAvailability(coiffeurId),
      this.salon.listTimeOff(coiffeurId),
      this.activeRowsWhere('coiffeur_id', coiffeurId),
      options.particulierId ? this.activeRowsWhere('particulier_id', options.particulierId) : Promise.resolve([]),
      findSalonSubscription(this.supabase, coiffeurId),
    ]);
    const counts = (row: AppointmentRow) => holdsSlot(row) && row.id !== options.excludeAppointmentId;
    // Past the end of a subscription on its way out (cancelled, or an offered one), the
    // salon leaves WorldHair: no time after it can be booked or moved to.
    const subscriptionEnd = subscriptionEndsAt(subscription);
    const afterSubscription = subscriptionEnd ? [{ startsAt: subscriptionEnd, endsAt: '9999-12-31T00:00:00.000Z' }] : [];
    return {
      availability,
      closures: [...closures.map(({ startsAt, endsAt }) => ({ startsAt, endsAt })), ...afterSubscription],
      salonBookings: salonRows.filter(counts).map(toBusy),
      // The client's bookings at this same salon are already in salonBookings.
      clientBookings: clientRows.filter((row) => counts(row) && row.coiffeur_id !== coiffeurId).map(toBusy),
      bookingNoticeMinutes: options.bookingNoticeMinutes,
      now: new Date(),
    };
  }

  private assertSlot(rules: BookingRules, startsAt: Date, durationMin: number, audience: 'client' | 'salon'): void {
    const refusal = refusalFor(rules, startsAt, durationMin);
    if (refusal === null) return;
    if (refusal === 'client_busy' && audience === 'salon') {
      throw new BadRequestException('The client already has an appointment at that time');
    }
    throw new BadRequestException(REFUSAL_MESSAGES[refusal]);
  }

  private async rowsWhere(
    column: 'particulier_id' | 'coiffeur_id',
    value: string,
    columns = '*',
  ): Promise<AppointmentRow[]> {
    const { data, error } = await this.supabase.client.from('appointments').select(columns).eq(column, value);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data as unknown as AppointmentRow[];
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

  private async salonsFor(
    coiffeurIds: string[],
  ): Promise<Map<string, { name: string; cancellationNoticeMinutes: number }>> {
    if (coiffeurIds.length === 0) return new Map();
    const { data, error } = await this.supabase.client
      .from('coiffeur_profiles')
      .select()
      .in('profile_id', coiffeurIds);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return new Map(
      (data as { profile_id: string; salon_name: string; cancellation_notice_minutes: number }[]).map((row) => [
        row.profile_id,
        { name: row.salon_name, cancellationNoticeMinutes: row.cancellation_notice_minutes ?? 0 },
      ]),
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
      modifiableUntil: modifiableUntil(row, cancellationNoticeMinutes),
      movedBySalon: row.moved_by_salon ?? false,
      payment: clientPayment(row),
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
      services: linesOf(row),
      status: derivedStatus(row, now),
      attendance: (row.attendance as Attendance | null | undefined) ?? null,
      note: row.client_note ?? undefined,
      isNewClient,
      payment: salonPayment(row),
    };
  }
}
