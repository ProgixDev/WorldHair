import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type Stripe from 'stripe';
import { SupabaseService } from '../database/supabase.service';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { StripeService } from '../stripe/stripe.service';
import { PayoutAccountsService } from './payout-accounts.service';

/** Why money goes back — kept in Stripe's refund metadata. */
export type RefundReason =
  | 'salon_refused'
  | 'salon_cancelled'
  | 'client_cancelled'
  | 'request_expired'
  | 'coiffeur_manual'
  | 'admin';

export interface PaymentRow {
  id: string;
  appointment_id: string;
  particulier_id: string;
  coiffeur_id: string;
  payment_intent_id: string;
  charge_id: string | null;
  amount: number | string;
  currency: string;
  commission_rate: number | string;
  commission_amount: number | string;
  status: 'requires_payment' | 'succeeded' | 'canceled';
  refunded_amount: number | string;
  transfer_id: string | null;
  transfer_amount: number | string | null;
  transferred_at: string | null;
  created_at: string;
}

export interface StartPaymentInput {
  appointmentId: string;
  particulierId: string;
  coiffeurId: string;
  /** Euros, TTC: the prestations' total. */
  amount: number;
  description: string;
  /** Stripe emails the receipt there. */
  email: string | null;
}

export interface AdminPaymentSummary {
  id: string;
  appointmentId: string;
  createdAt: string;
  clientName: string;
  salonName: string;
  amount: number;
  refundedAmount: number;
  commissionAmount: number;
  transferAmount: number | null;
  transferredAt: string | null;
  status: PaymentRow['status'];
}

/** A salon is paid a day after the appointment: time to mark a no-show or refund by hand first. */
export const PAYOUT_DELAY_MS = 24 * 3_600_000;

const toCents = (euros: number) => Math.round(euros * 100);
const round2 = (euros: number) => Math.round(euros * 100) / 100;

/**
 * The money side of a booking (TODO.md Phase 5), with separate charges and
 * transfers: WorldHair charges the client's card for the full price when
 * the request is sent, holds it, and a day after the appointment transfers
 * the salon's share — the price minus the commission, on what the client
 * kept — to its Stripe account. Refunds and transfers carry idempotency
 * keys, so a retry never pays or refunds twice.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly stripe: StripeService,
    private readonly settings: PlatformSettingsService,
    private readonly payouts: PayoutAccountsService,
    private readonly events: EventEmitter2,
  ) {}

  async startPayment(input: StartPaymentInput): Promise<{ clientSecret: string }> {
    const { commissionPercent } = await this.settings.get();
    const intent = await this.stripe.client.paymentIntents.create(
      {
        amount: toCents(input.amount),
        currency: 'eur',
        automatic_payment_methods: { enabled: true },
        description: input.description,
        ...(input.email ? { receipt_email: input.email } : {}),
        transfer_group: input.appointmentId,
        metadata: {
          appointment_id: input.appointmentId,
          particulier_id: input.particulierId,
          coiffeur_id: input.coiffeurId,
        },
      },
      { idempotencyKey: `payment-${input.appointmentId}` },
    );
    if (!intent.client_secret) {
      throw new InternalServerErrorException('Stripe returned no client secret');
    }

    const { error } = await this.supabase.client
      .from('payments')
      .insert({
        appointment_id: input.appointmentId,
        particulier_id: input.particulierId,
        coiffeur_id: input.coiffeurId,
        payment_intent_id: intent.id,
        amount: input.amount,
        commission_rate: commissionPercent,
        commission_amount: round2((input.amount * commissionPercent) / 100),
        status: 'requires_payment',
      })
      .select()
      .single();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return { clientSecret: intent.client_secret };
  }

  async findByAppointment(appointmentId: string): Promise<PaymentRow | null> {
    return this.findWhere('appointment_id', appointmentId);
  }

  async findByIntent(paymentIntentId: string): Promise<PaymentRow | null> {
    return this.findWhere('payment_intent_id', paymentIntentId);
  }

  /** Stripe's own word on whether the client paid. */
  async retrieveIntent(payment: PaymentRow): Promise<Stripe.PaymentIntent> {
    return this.stripe.client.paymentIntents.retrieve(payment.payment_intent_id);
  }

  async markSucceeded(payment: PaymentRow, intent: Stripe.PaymentIntent): Promise<void> {
    const chargeId = intent.latest_charge ? (typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge.id) : null;
    await this.update(payment.id, { status: 'succeeded', charge_id: chargeId });
  }

  /**
   * Releasing a hold: the payment can't go through any more. Answers what
   * Stripe says if the client paid (or is paying) after all — then the hold
   * must be kept.
   */
  async cancelIntent(payment: PaymentRow): Promise<'canceled' | 'succeeded' | 'processing'> {
    const intent = await this.retrieveIntent(payment);
    if (intent.status === 'succeeded') return 'succeeded';
    if (intent.status === 'processing') return 'processing';
    if (intent.status !== 'canceled') {
      await this.stripe.client.paymentIntents.cancel(intent.id);
    }
    await this.update(payment.id, { status: 'canceled' });
    return 'canceled';
  }

  /**
   * Gives money back — everything left by default. Once the salon has been
   * paid, only an admin can refund, and the salon's share of it is taken
   * back from its transfer first. Answers the amount refunded (0 when there
   * was nothing to refund: a booking made before payments, or unpaid).
   */
  async refund(appointmentId: string, options: { amount?: number; reason: RefundReason }): Promise<number> {
    const payment = await this.findByAppointment(appointmentId);
    if (!payment || payment.status !== 'succeeded') return 0;

    const amount = Number(payment.amount);
    const refunded = Number(payment.refunded_amount);
    const remaining = round2(amount - refunded);
    if (options.amount !== undefined && (options.amount <= 0 || options.amount > remaining)) {
      throw new BadRequestException(`At most ${remaining} € left to refund`);
    }
    const wanted = round2(options.amount ?? remaining);
    if (wanted <= 0) return 0;

    if (payment.transfer_id) {
      if (options.reason !== 'admin') {
        throw new BadRequestException('Already paid out to the salon: only WorldHair can refund now');
      }
      const reversal = round2((wanted * Number(payment.transfer_amount ?? 0)) / amount);
      if (reversal > 0) {
        await this.stripe.client.transfers.createReversal(
          payment.transfer_id,
          { amount: toCents(reversal) },
          { idempotencyKey: `reversal-${payment.id}-${toCents(refunded)}-${toCents(wanted)}` },
        );
      }
    }

    await this.stripe.client.refunds.create(
      {
        payment_intent: payment.payment_intent_id,
        amount: toCents(wanted),
        reason: 'requested_by_customer',
        metadata: { appointment_id: appointmentId, why: options.reason },
      },
      { idempotencyKey: `refund-${payment.id}-${toCents(refunded)}-${toCents(wanted)}` },
    );
    const refundedTotal = round2(refunded + wanted);
    await this.update(payment.id, { refunded_amount: refundedTotal });
    this.events.emit('payment.refunded', {
      appointmentId,
      particulierId: payment.particulier_id,
      amount: wanted,
      refundedTotal,
    });
    return wanted;
  }

  /** A client paid for a hold that had already been released: there's no booking, so all of it goes back. */
  async refundOrphan(intent: Stripe.PaymentIntent): Promise<void> {
    this.logger.warn(`Payment ${intent.id} succeeded for a released hold — refunded`);
    await this.stripe.client.refunds.create(
      { payment_intent: intent.id, reason: 'requested_by_customer', metadata: { why: 'hold_released' } },
      { idempotencyKey: `orphan-${intent.id}` },
    );
  }

  /** `charge.refunded`: a refund made anywhere, Stripe's dashboard included. */
  async syncRefund(charge: Stripe.Charge): Promise<void> {
    const intentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
    if (!intentId) return;
    const payment = await this.findByIntent(intentId);
    if (!payment) return;
    await this.update(payment.id, { refunded_amount: charge.amount_refunded / 100 });
  }

  /**
   * Pays the salons (hourly): every payment whose appointment ended a day
   * ago, went ahead (not refused or cancelled) and wasn't fully refunded.
   * The commission is taken on what the client kept. A salon without payouts
   * yet — the demo one — waits; its money stays with WorldHair.
   */
  async transferDue(now = new Date()): Promise<number> {
    const { data, error } = await this.supabase.client
      .from('payments')
      .select()
      .eq('status', 'succeeded')
      .is('transfer_id', null);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    const due = data as PaymentRow[];
    if (due.length === 0) return 0;

    const { data: appointmentRows, error: appointmentsError } = await this.supabase.client
      .from('appointments')
      .select()
      .in(
        'id',
        due.map((payment) => payment.appointment_id),
      );
    if (appointmentsError) {
      throw new InternalServerErrorException(appointmentsError.message);
    }
    const appointments = new Map(
      (appointmentRows as { id: string; status: string; starts_at: string; duration_min: number }[]).map((row) => [row.id, row]),
    );

    let transferred = 0;
    for (const payment of due) {
      const appointment = appointments.get(payment.appointment_id);
      if (!appointment || appointment.status !== 'confirmed') continue;
      const endsAt = new Date(appointment.starts_at).getTime() + appointment.duration_min * 60_000;
      if (endsAt + PAYOUT_DELAY_MS > now.getTime()) continue;

      const kept = round2(Number(payment.amount) - Number(payment.refunded_amount));
      const commission = round2((kept * Number(payment.commission_rate)) / 100);
      const share = round2(kept - commission);
      if (share <= 0) continue;
      const destination = await this.payouts.readyAccountId(payment.coiffeur_id);
      if (!destination) continue;

      try {
        const transfer = await this.stripe.client.transfers.create(
          {
            amount: toCents(share),
            currency: payment.currency,
            destination,
            transfer_group: payment.appointment_id,
            ...(payment.charge_id ? { source_transaction: payment.charge_id } : {}),
            metadata: { appointment_id: payment.appointment_id, payment_id: payment.id },
          },
          { idempotencyKey: `transfer-${payment.id}` },
        );
        await this.update(payment.id, {
          transfer_id: transfer.id,
          transfer_amount: share,
          transferred_at: now.toISOString(),
          commission_amount: commission,
        });
        transferred += 1;
      } catch (err) {
        this.logger.error(`Transfer failed for payment ${payment.id}`, err as Error);
      }
    }
    return transferred;
  }

  async listForAdmin(): Promise<AdminPaymentSummary[]> {
    const { data, error } = await this.supabase.client.from('payments').select().order('created_at', { ascending: false });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    const rows = data as PaymentRow[];
    const names = await this.namesFor([...new Set(rows.flatMap((row) => [row.particulier_id, row.coiffeur_id]))]);
    const salons = await this.salonNamesFor([...new Set(rows.map((row) => row.coiffeur_id))]);
    return rows.map((row) => ({
      id: row.id,
      appointmentId: row.appointment_id,
      createdAt: row.created_at,
      clientName: names.get(row.particulier_id) ?? 'Client',
      salonName: salons.get(row.coiffeur_id) ?? names.get(row.coiffeur_id) ?? 'Salon',
      amount: Number(row.amount),
      refundedAmount: Number(row.refunded_amount),
      commissionAmount: Number(row.commission_amount),
      transferAmount: row.transfer_amount === null ? null : Number(row.transfer_amount),
      transferredAt: row.transferred_at,
      status: row.status,
    }));
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async findWhere(column: 'appointment_id' | 'payment_intent_id', value: string): Promise<PaymentRow | null> {
    const { data, error } = await this.supabase.client.from('payments').select().eq(column, value).maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data as PaymentRow | null;
  }

  private async update(id: string, patch: Record<string, unknown>): Promise<void> {
    const { error } = await this.supabase.client.from('payments').update(patch).eq('id', id);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  private async namesFor(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const { data, error } = await this.supabase.client.from('profiles').select().in('id', ids);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return new Map(
      (data as { id: string; first_name: string; last_name: string }[]).map((row) => [
        row.id,
        `${row.first_name} ${row.last_name}`.trim(),
      ]),
    );
  }

  private async salonNamesFor(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const { data, error } = await this.supabase.client.from('coiffeur_profiles').select().in('profile_id', ids);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return new Map((data as { profile_id: string; salon_name: string }[]).map((row) => [row.profile_id, row.salon_name]));
  }
}
