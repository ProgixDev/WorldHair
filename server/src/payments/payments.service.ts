import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type Stripe from 'stripe';
import { slices } from '../common/utils/slices';
import { paymentReturnPageUrl } from '../common/utils/web-links';
import { EnvironmentVariables } from '../config/env.validation';
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
  | 'admin'
  /** Made later by the job: a cancelled or refused booking whose refund failed at the time. */
  | 'owed';

export interface PaymentRow {
  id: string;
  appointment_id: string;
  particulier_id: string;
  coiffeur_id: string;
  /** Known once the client paid on Stripe's page. */
  payment_intent_id: string | null;
  /** Stripe's payment page (Checkout) the app opened for this booking. */
  checkout_session_id: string | null;
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
  /** Set before each try at sending the salon its share: from the first one on, only an admin refunds. */
  transfer_attempted_at: string | null;
  /** Taken back from the transfer by admin refunds after the payout. */
  reversed_amount: number | string;
  /** Held while a refund or the payout runs (see `lock`). */
  locked_until: string | null;
  created_at: string;
}

export interface StartPaymentInput {
  appointmentId: string;
  particulierId: string;
  coiffeurId: string;
  /** Euros, TTC: the prestations' total. */
  amount: number;
  /** What Stripe's page, the receipt and the bank statement read: the salon and the prestations. */
  label: string;
  /** Under it on Stripe's page: the day and time. */
  details: string;
  /** Filled in on Stripe's page, and where it emails the receipt. */
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
  /** What the salon kept of its payout, anything taken back since deducted; `null` until paid out. */
  transferAmount: number | null;
  transferredAt: string | null;
  status: PaymentRow['status'];
}

interface SentTransfer {
  id: string;
  /** Euros. */
  amount: number;
  sentAt: string;
}

/** A salon is paid a day after the appointment: time to mark a no-show or refund by hand first. */
export const PAYOUT_DELAY_MS = 24 * 3_600_000;

/** Stripe keeps a payment page open 30 minutes at least; the slot's hold is shorter and closes it itself (`closeCheckout`). */
const CHECKOUT_OPEN_MINUTES = 31;

/** How long a refund or a payout may hold a payment: Stripe's slowest answer, retries included. A server that dies holding it frees it by then. */
const LOCK_MS = 5 * 60_000;
/** Payouts sent per (hourly) run — well beyond a day's bookings. */
const PAYOUT_BATCH = 200;
/** Owed refunds retried per run. */
const OWED_BATCH = 100;
/** PostgREST's max rows per answer. */
const PAGE_ROWS = 1000;

const toCents = (euros: number) => Math.round(euros * 100);
const round2 = (euros: number) => Math.round(euros * 100) / 100;

/** The salon's share of what the client kept: the commission comes off, to the cent. */
function salonShare(kept: number, commissionRate: number): number {
  return round2(kept - round2((kept * commissionRate) / 100));
}

/**
 * The money side of a booking (TODO.md Phase 5), with separate charges and
 * transfers: WorldHair charges the client's card for the full price when
 * the request is sent — on Stripe's own payment page, which the app opens
 * in the browser — holds it, and a day after the appointment transfers
 * the salon's share — the price minus the commission, on what the client
 * kept — to its Stripe account. Refunds and transfers carry idempotency
 * keys, so a retry never pays or refunds twice, and never run at the same
 * time on one payment (see `lock`).
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
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /**
   * Stripe's payment page for a held booking: the app opens it in the
   * browser, the client pays there (3-D Secure too, when the bank asks) and
   * Stripe sends them back through the website to the app. Cards only: an
   * answer at once, well within the slot's hold.
   */
  async startPayment(input: StartPaymentInput): Promise<{ url: string }> {
    const back = paymentReturnPageUrl(this.config.get('WEB_APP_URL', { infer: true }));
    if (!back) {
      throw new ServiceUnavailableException('WEB_APP_URL is not configured');
    }
    const { commissionPercent } = await this.settings.get();
    const metadata = {
      appointment_id: input.appointmentId,
      particulier_id: input.particulierId,
      coiffeur_id: input.coiffeurId,
    };
    const session = await this.stripe.client.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'eur',
              unit_amount: toCents(input.amount),
              product_data: { name: input.label, description: input.details },
            },
          },
        ],
        submit_type: 'book',
        locale: 'fr',
        client_reference_id: input.appointmentId,
        ...(input.email ? { customer_email: input.email } : {}),
        payment_intent_data: {
          description: `WorldHair — ${input.label}`,
          transfer_group: input.appointmentId,
          metadata,
          ...(input.email ? { receipt_email: input.email } : {}),
        },
        metadata,
        success_url: `${back}?etat=paye`,
        cancel_url: `${back}?etat=annule`,
        expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_OPEN_MINUTES * 60,
      },
      { idempotencyKey: `checkout-${input.appointmentId}` },
    );
    if (!session.url) {
      throw new InternalServerErrorException('Stripe returned no payment page');
    }

    const { error } = await this.supabase.client
      .from('payments')
      .insert({
        appointment_id: input.appointmentId,
        particulier_id: input.particulierId,
        coiffeur_id: input.coiffeurId,
        checkout_session_id: session.id,
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
    return { url: session.url };
  }

  async findByAppointment(appointmentId: string): Promise<PaymentRow | null> {
    return this.findWhere('appointment_id', appointmentId);
  }

  async findByIntent(paymentIntentId: string): Promise<PaymentRow | null> {
    return this.findWhere('payment_intent_id', paymentIntentId);
  }

  /** Stripe's own word: the client's PaymentIntent once they paid on the page, `null` until then. */
  async paidIntent(payment: PaymentRow): Promise<Stripe.PaymentIntent | null> {
    let intentId = payment.payment_intent_id;
    if (!intentId && payment.checkout_session_id) {
      const session = await this.stripe.client.checkout.sessions.retrieve(payment.checkout_session_id);
      if (session.payment_status !== 'paid' || !session.payment_intent) return null;
      intentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id;
    }
    if (!intentId) return null;
    const intent = await this.stripe.client.paymentIntents.retrieve(intentId);
    return intent.status === 'succeeded' ? intent : null;
  }

  async markSucceeded(payment: PaymentRow, intent: Stripe.PaymentIntent): Promise<void> {
    const chargeId = intent.latest_charge ? (typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge.id) : null;
    await this.update(payment.id, { status: 'succeeded', payment_intent_id: intent.id, charge_id: chargeId });
  }

  /**
   * Releasing a hold: Stripe's page is closed, so it can't be paid any more
   * (Stripe would keep it open 30 minutes). Answers the payment when the
   * client paid after all — then the hold must stay.
   */
  async closeCheckout(payment: PaymentRow): Promise<Stripe.PaymentIntent | null> {
    const paid = await this.paidIntent(payment);
    if (paid) return paid;
    if (payment.checkout_session_id) {
      const session = await this.stripe.client.checkout.sessions.retrieve(payment.checkout_session_id);
      if (session.status === 'open') {
        try {
          await this.stripe.client.checkout.sessions.expire(session.id);
        } catch (err) {
          // Paid that very moment: the page can't be closed any more.
          const justPaid = await this.paidIntent(payment);
          if (justPaid) return justPaid;
          throw err;
        }
      }
    }
    await this.update(payment.id, { status: 'canceled' });
    return null;
  }

  /**
   * Gives money back — everything left by default. What's left is counted
   * by Stripe, so a refund made from its dashboard, or one whose webhook is
   * late, is never given twice. Once the salon's payout has started, only
   * an admin can refund, and the salon's share of it is taken back from its
   * transfer first. Answers the amount refunded (0 when there was nothing to
   * refund: a booking made before payments, or unpaid).
   */
  async refund(appointmentId: string, options: { amount?: number; reason: RefundReason }): Promise<number> {
    const found = await this.findByAppointment(appointmentId);
    if (!found || found.status !== 'succeeded') return 0;
    return this.withLock(
      found.id,
      new Date(),
      (payment) => this.refundLocked(payment, options),
      () => {
        throw new ConflictException('This payment is being processed: try again in a minute');
      },
    );
  }

  /**
   * Every cancelled or refused booking is owed everything back — the rules
   * leave no exception. A refund that failed when it happened (Stripe down)
   * is made here instead, every few minutes until it goes through.
   */
  async refundOwed(): Promise<number> {
    const { data, error } = await this.supabase.client.rpc('refunds_owed', { p_limit: OWED_BATCH });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    let refunded = 0;
    for (const payment of data as PaymentRow[]) {
      try {
        if ((await this.refund(payment.appointment_id, { reason: 'owed' })) > 0) refunded += 1;
      } catch (err) {
        this.logger.warn(`Refund owed for appointment ${payment.appointment_id} failed again`, err as Error);
      }
    }
    return refunded;
  }

  /** A client paid for a hold that had already been released: there's no booking, so all of it goes back. */
  async refundOrphan(intent: Stripe.PaymentIntent): Promise<void> {
    this.logger.warn(`Payment ${intent.id} succeeded for a released hold — refunded`);
    await this.stripe.client.refunds.create(
      { payment_intent: intent.id, reason: 'requested_by_customer', metadata: { why: 'hold_released' } },
      { idempotencyKey: `orphan-${intent.id}` },
    );
  }

  /** `charge.refunded`: a refund made anywhere, Stripe's dashboard included. Its events come in any order, so Stripe's count is read afresh. */
  async syncRefund(charge: Stripe.Charge): Promise<void> {
    const intentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
    if (!intentId) return;
    const payment = await this.findByIntent(intentId);
    if (!payment) return;
    const current = await this.stripe.client.charges.retrieve(charge.id);
    await this.raiseRefunded(payment.id, current.amount_refunded / 100);
  }

  /**
   * Pays the salons (hourly): each paid, accepted booking a day after it
   * ended, at a salon whose payouts are on. The database picks them
   * (payouts_due), so bookings that will never be paid out — refused,
   * refunded, the demo salon's — never pile up in the way. A salon without
   * payouts yet waits; its money stays with WorldHair until it sets them up.
   */
  async transferDue(now = new Date()): Promise<number> {
    const { data, error } = await this.supabase.client.rpc('payouts_due', {
      p_cutoff: new Date(now.getTime() - PAYOUT_DELAY_MS).toISOString(),
      p_limit: PAYOUT_BATCH,
    });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    let transferred = 0;
    for (const due of data as PaymentRow[]) {
      try {
        // Held by a refund right now: the next run pays it, on what the client kept by then.
        if (await this.withLock(due.id, now, (payment) => this.payOut(payment, now), () => false)) transferred += 1;
      } catch (err) {
        this.logger.error(`Transfer failed for payment ${due.id}`, err as Error);
      }
    }
    return transferred;
  }

  async listForAdmin(): Promise<AdminPaymentSummary[]> {
    const rows = await this.allPayments();
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
      transferAmount: row.transfer_amount === null ? null : round2(Number(row.transfer_amount) - Number(row.reversed_amount)),
      transferredAt: row.transferred_at,
      status: row.status,
    }));
  }

  // ─── Refunds and payouts, under the payment's lock ───────────────────────

  private async refundLocked(payment: PaymentRow, options: { amount?: number; reason: RefundReason }): Promise<number> {
    const refunded = await this.refundedSoFar(payment);
    const remaining = round2(Number(payment.amount) - refunded);
    if (options.amount !== undefined && (options.amount <= 0 || options.amount > remaining)) {
      throw new BadRequestException(`At most ${remaining} € left to refund`);
    }
    const wanted = round2(options.amount ?? remaining);
    if (wanted <= 0) return 0;
    const refundedTotal = round2(refunded + wanted);

    if (payment.transfer_id || payment.transfer_attempted_at) {
      if (options.reason !== 'admin') {
        throw new BadRequestException('Already paid out to the salon: only WorldHair can refund now');
      }
      await this.takeBackShare(payment, refundedTotal);
    }

    await this.stripe.client.refunds.create(
      {
        payment_intent: payment.payment_intent_id!,
        amount: toCents(wanted),
        reason: 'requested_by_customer',
        metadata: { appointment_id: payment.appointment_id, why: options.reason },
      },
      { idempotencyKey: `refund-${payment.id}-${toCents(refunded)}-${toCents(wanted)}` },
    );
    await this.raiseRefunded(payment.id, refundedTotal);
    this.events.emit('payment.refunded', {
      appointmentId: payment.appointment_id,
      particulierId: payment.particulier_id,
      amount: wanted,
      refundedTotal,
    });
    return wanted;
  }

  /**
   * An admin refund after the payout: the salon keeps its share of what the
   * client still pays, no more — the difference comes back from its
   * transfer before the client is refunded. Worked out on the totals, not
   * refund by refund, so rounding never asks back more than was sent.
   */
  private async takeBackShare(payment: PaymentRow, refundedTotal: number): Promise<void> {
    const transfer = await this.sentTransfer(payment);
    if (!transfer) {
      if (await this.isStillOn(payment.appointment_id)) {
        throw new ConflictException("The salon's payout is on its way: try again in an hour");
      }
      // A payout Stripe refused, for a booking cancelled since (a dispute): it's never tried again, so nothing was sent and nothing will be.
      await this.update(payment.id, { transfer_attempted_at: null });
      return;
    }
    const kept = round2(Number(payment.amount) - refundedTotal);
    const reversedTotal = round2(
      Math.min(transfer.amount, Math.max(0, transfer.amount - salonShare(kept, Number(payment.commission_rate)))),
    );
    const reversal = round2(reversedTotal - Number(payment.reversed_amount));
    if (reversal > 0) {
      await this.stripe.client.transfers.createReversal(
        transfer.id,
        { amount: toCents(reversal) },
        { idempotencyKey: `reversal-${payment.id}-${toCents(reversedTotal)}` },
      );
    }
    await this.update(payment.id, {
      reversed_amount: reversedTotal,
      commission_amount: round2(kept - (transfer.amount - reversedTotal)),
    });
  }

  private async payOut(payment: PaymentRow, now: Date): Promise<boolean> {
    if (payment.transfer_id) return false;
    const destination = await this.payouts.readyAccountId(payment.coiffeur_id);
    if (!destination) return false;

    const refunded = await this.refundedSoFar(payment);
    if (refunded > Number(payment.refunded_amount)) await this.raiseRefunded(payment.id, refunded);
    const kept = round2(Number(payment.amount) - refunded);

    // An earlier try may have reached Stripe without being written down here.
    const earlier = payment.transfer_attempted_at ? await this.findTransfer(payment) : null;
    if (earlier) {
      await this.recordTransfer(payment.id, earlier, kept);
      return true;
    }

    // Cancelled since the run listed it (an admin settling a dispute): the salon isn't paid.
    if (!(await this.isStillOn(payment.appointment_id))) return false;

    const share = salonShare(kept, Number(payment.commission_rate));
    if (share <= 0) return false;
    await this.update(payment.id, { transfer_attempted_at: now.toISOString() });
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
    await this.recordTransfer(payment.id, { id: transfer.id, amount: share, sentAt: now.toISOString() }, kept);
    return true;
  }

  private async recordTransfer(paymentId: string, transfer: SentTransfer, kept: number): Promise<void> {
    await this.update(paymentId, {
      transfer_id: transfer.id,
      transfer_amount: transfer.amount,
      transferred_at: transfer.sentAt,
      commission_amount: round2(kept - transfer.amount),
    });
  }

  /** The salon's transfer as recorded — or sent by an earlier try without being written down: found on Stripe, and recorded now. */
  private async sentTransfer(payment: PaymentRow): Promise<SentTransfer | null> {
    if (payment.transfer_id) {
      return { id: payment.transfer_id, amount: Number(payment.transfer_amount ?? 0), sentAt: payment.transferred_at ?? '' };
    }
    const found = await this.findTransfer(payment);
    if (found) await this.recordTransfer(payment.id, found, round2(Number(payment.amount) - Number(payment.refunded_amount)));
    return found;
  }

  private async findTransfer(payment: PaymentRow): Promise<SentTransfer | null> {
    const { data } = await this.stripe.client.transfers.list({ transfer_group: payment.appointment_id, limit: 1 });
    const [transfer] = data;
    return transfer
      ? { id: transfer.id, amount: transfer.amount / 100, sentAt: new Date(transfer.created * 1000).toISOString() }
      : null;
  }

  /** Stripe's count of what went back — whoever refunded, its dashboard included, event arrived or not. */
  private async refundedSoFar(payment: PaymentRow): Promise<number> {
    const recorded = Number(payment.refunded_amount);
    if (!payment.charge_id) return recorded;
    const charge = await this.stripe.client.charges.retrieve(payment.charge_id);
    return Math.max(recorded, charge.amount_refunded / 100);
  }

  /** Refunds only add up: a figure arriving late never lowers the one recorded. */
  private async raiseRefunded(paymentId: string, refundedTotal: number): Promise<void> {
    const { error } = await this.supabase.client
      .from('payments')
      .update({ refunded_amount: refundedTotal })
      .eq('id', paymentId)
      .lt('refunded_amount', refundedTotal);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Runs `work` holding the payment's lock, so a refund and the salon's
   * payout never overlap and each reads what the other wrote. Answers
   * `busy()` while someone else holds it.
   */
  private async withLock<T>(
    paymentId: string,
    now: Date,
    work: (payment: PaymentRow) => Promise<T>,
    busy: () => T,
  ): Promise<T> {
    const payment = await this.lock(paymentId, now);
    if (!payment) return busy();
    try {
      return await work(payment);
    } finally {
      await this.unlock(paymentId);
    }
  }

  /**
   * A lease on the row, taken by a conditional update: free, or left by a
   * server that died holding it (two updates, each atomic). Answers the row
   * as it now stands, or null when someone else holds it.
   */
  private async lock(paymentId: string, now: Date): Promise<PaymentRow | null> {
    const lease = { locked_until: new Date(now.getTime() + LOCK_MS).toISOString() };
    const free = await this.supabase.client
      .from('payments')
      .update(lease)
      .eq('id', paymentId)
      .is('locked_until', null)
      .select()
      .maybeSingle();
    if (free.error) {
      throw new InternalServerErrorException(free.error.message);
    }
    if (free.data) return free.data as PaymentRow;
    const abandoned = await this.supabase.client
      .from('payments')
      .update(lease)
      .eq('id', paymentId)
      .lt('locked_until', now.toISOString())
      .select()
      .maybeSingle();
    if (abandoned.error) {
      throw new InternalServerErrorException(abandoned.error.message);
    }
    return abandoned.data as PaymentRow | null;
  }

  private async unlock(paymentId: string): Promise<void> {
    const { error } = await this.supabase.client.from('payments').update({ locked_until: null }).eq('id', paymentId);
    // Not worth failing what was done for: the lease runs out by itself.
    if (error) this.logger.warn(`Couldn't unlock payment ${paymentId}: ${error.message}`);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** The booking still stands as accepted — the only kind a salon is paid for. */
  private async isStillOn(appointmentId: string): Promise<boolean> {
    const { data, error } = await this.supabase.client.from('appointments').select('status').eq('id', appointmentId).maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data as { status: string } | null)?.status === 'confirmed';
  }

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

  /** Newest first, every page of them. */
  private async allPayments(): Promise<PaymentRow[]> {
    const rows: PaymentRow[] = [];
    for (let from = 0; ; from += PAGE_ROWS) {
      const { data, error } = await this.supabase.client
        .from('payments')
        .select()
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, from + PAGE_ROWS - 1);
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
      const page = data as PaymentRow[];
      rows.push(...page);
      if (page.length < PAGE_ROWS) return rows;
    }
  }

  private async namesFor(ids: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    for (const slice of slices(ids)) {
      const { data, error } = await this.supabase.client.from('profiles').select().in('id', slice);
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
      for (const row of data as { id: string; first_name: string; last_name: string }[]) {
        names.set(row.id, `${row.first_name} ${row.last_name}`.trim());
      }
    }
    return names;
  }

  private async salonNamesFor(ids: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    for (const slice of slices(ids)) {
      const { data, error } = await this.supabase.client.from('coiffeur_profiles').select().in('profile_id', slice);
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
      for (const row of data as { profile_id: string; salon_name: string }[]) names.set(row.profile_id, row.salon_name);
    }
    return names;
  }
}
