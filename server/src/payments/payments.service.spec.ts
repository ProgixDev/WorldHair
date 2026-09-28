import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type Stripe from 'stripe';
import { EnvironmentVariables } from '../config/env.validation';
import { SupabaseService } from '../database/supabase.service';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { StripeService } from '../stripe/stripe.service';
import { FakeStripe } from '../../test/utils/fakes/fake-stripe';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { PaymentsService } from './payments.service';
import { PayoutAccountsService } from './payout-accounts.service';

const COIFFEUR_ID = 'coiffeur-1';
const CLIENT_ID = 'client-1';
const HOUR_MS = 3_600_000;
const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR_MS).toISOString();

function testConfig(): ConfigService<EnvironmentVariables, true> {
  const values: Record<string, unknown> = { STRIPE_SECRET_KEY: 'sk_test_123', WEB_APP_URL: 'https://worldhair.test' };
  return { get: (key: string) => values[key] } as unknown as ConfigService<EnvironmentVariables, true>;
}

describe('PaymentsService', () => {
  let supabase: FakeSupabaseService;
  let stripe: FakeStripe;
  let events: EventEmitter2;
  let payments: PaymentsService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    stripe = new FakeStripe();
    events = new EventEmitter2();
    const config = testConfig();
    const stripeService = new StripeService(stripe as unknown as Stripe, config);
    payments = new PaymentsService(
      supabase as unknown as SupabaseService,
      stripeService,
      new PlatformSettingsService(supabase as unknown as SupabaseService),
      new PayoutAccountsService(supabase as unknown as SupabaseService, stripeService, config),
      events,
      config,
    );
  });

  function appointment(overrides: { startsAt?: string; durationMin?: number; status?: string } = {}): string {
    return supabase.seedAppointment({
      particulierId: CLIENT_ID,
      coiffeurId: COIFFEUR_ID,
      startsAt: overrides.startsAt ?? hoursAgo(26),
      durationMin: overrides.durationMin ?? 60,
      status: overrides.status ?? 'confirmed',
    });
  }

  function startFor(id: string) {
    return payments.startPayment({
      appointmentId: id,
      particulierId: CLIENT_ID,
      coiffeurId: COIFFEUR_ID,
      amount: 45,
      label: 'Studio W — Coupe & brushing',
      details: 'mer. 30 sept. à 10:00',
      email: 'camille@example.com',
    });
  }

  describe('startPayment', () => {
    it("opens Stripe's payment page for the full price, tagged with the appointment, and keeps the day's commission rate", async () => {
      supabase.seedPlatformSettings({ commissionPercent: 12 });
      const id = appointment({ status: 'awaiting_payment' });

      const { url } = await startFor(id);

      expect(url).toBe('https://checkout.stripe.test/cs_test_1');
      expect(stripe.checkoutSessionsCreated[0]).toMatchObject({
        mode: 'payment',
        payment_method_types: ['card'],
        submit_type: 'book',
        locale: 'fr',
        customer_email: 'camille@example.com',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'eur',
              unit_amount: 4500,
              product_data: { name: 'Studio W — Coupe & brushing', description: 'mer. 30 sept. à 10:00' },
            },
          },
        ],
        payment_intent_data: {
          transfer_group: id,
          receipt_email: 'camille@example.com',
          metadata: { appointment_id: id, particulier_id: CLIENT_ID, coiffeur_id: COIFFEUR_ID },
        },
        success_url: 'https://worldhair.test/paiement/retour?etat=paye',
        cancel_url: 'https://worldhair.test/paiement/retour?etat=annule',
      });
      expect(stripe.checkoutIdempotencyKeys[0]).toBe(`checkout-${id}`);
      // Stripe keeps a page open 30 minutes at least; the hold closes it sooner (closeCheckout).
      expect((stripe.checkoutSessionsCreated[0].expires_at ?? 0) * 1000 - Date.now()).toBeGreaterThan(30 * 60_000);
      expect(supabase.paymentFor(id)).toMatchObject({
        amount: 45,
        status: 'requires_payment',
        commission_rate: 12,
        commission_amount: 5.4,
        checkout_session_id: 'cs_test_1',
        payment_intent_id: null,
      });
    });
  });

  describe('paidIntent / closeCheckout', () => {
    it('knows nothing is paid until the client pays on the page, then finds the payment', async () => {
      const id = appointment({ status: 'awaiting_payment' });
      await startFor(id);

      await expect(payments.paidIntent((await payments.findByAppointment(id))!)).resolves.toBeNull();
      stripe.completeCheckout('cs_test_1');
      await expect(payments.paidIntent((await payments.findByAppointment(id))!)).resolves.toMatchObject({ id: 'pi_test_1', latest_charge: 'ch_pi_test_1' });
    });

    it("closes Stripe's page when the hold goes, so it can't be paid any more", async () => {
      const id = appointment({ status: 'awaiting_payment' });
      await startFor(id);

      await expect(payments.closeCheckout((await payments.findByAppointment(id))!)).resolves.toBeNull();

      expect(stripe.sessionStatus('cs_test_1')).toBe('expired');
      expect(supabase.paymentFor(id)).toMatchObject({ status: 'canceled' });
    });

    it('answers the payment instead when the client paid first', async () => {
      const id = appointment({ status: 'awaiting_payment' });
      await startFor(id);
      stripe.completeCheckout('cs_test_1');

      await expect(payments.closeCheckout((await payments.findByAppointment(id))!)).resolves.toMatchObject({ id: 'pi_test_1' });
      expect(stripe.sessionStatus('cs_test_1')).toBe('complete');
      expect(supabase.paymentFor(id)).toMatchObject({ status: 'requires_payment' });
    });
  });

  describe('refund', () => {
    it('gives back everything left by default, and says so', async () => {
      const id = appointment();
      supabase.seedPayment({ appointmentId: id, particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 45, paymentIntentId: 'pi_1' });
      const heard = jest.fn();
      events.on('payment.refunded', heard);

      await expect(payments.refund(id, { reason: 'salon_refused' })).resolves.toBe(45);

      expect(stripe.refundsCreated[0].params).toMatchObject({ payment_intent: 'pi_1', amount: 4500 });
      expect(supabase.paymentFor(id)).toMatchObject({ refunded_amount: 45 });
      expect(heard).toHaveBeenCalledWith({ appointmentId: id, particulierId: CLIENT_ID, amount: 45, refundedTotal: 45 });
    });

    it('gives back part of it, never more than what is left', async () => {
      const id = appointment();
      supabase.seedPayment({ appointmentId: id, particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 45 });

      await expect(payments.refund(id, { amount: 20, reason: 'coiffeur_manual' })).resolves.toBe(20);
      await expect(payments.refund(id, { amount: 30, reason: 'coiffeur_manual' })).rejects.toThrow(BadRequestException);
      expect(supabase.paymentFor(id)).toMatchObject({ refunded_amount: 20 });
    });

    it('does nothing for a booking paid outside the app, or not paid yet', async () => {
      const unpaid = appointment({ status: 'awaiting_payment' });
      supabase.seedPayment({ appointmentId: unpaid, particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 45, status: 'requires_payment' });

      await expect(payments.refund(appointment(), { reason: 'client_cancelled' })).resolves.toBe(0);
      await expect(payments.refund(unpaid, { reason: 'client_cancelled' })).resolves.toBe(0);
      expect(stripe.refundsCreated).toEqual([]);
    });

    it("refuses a salon's refund once the money is paid out; an admin's takes the salon's share back first", async () => {
      const id = appointment();
      supabase.seedPayment({
        appointmentId: id,
        particulierId: CLIENT_ID,
        coiffeurId: COIFFEUR_ID,
        amount: 100,
        transferId: 'tr_1',
        transferAmount: 90,
      });

      await expect(payments.refund(id, { reason: 'coiffeur_manual' })).rejects.toThrow(BadRequestException);
      await expect(payments.refund(id, { amount: 50, reason: 'admin' })).resolves.toBe(50);

      expect(stripe.reversalsCreated).toEqual([{ transferId: 'tr_1', params: { amount: 4500 } }]);
      expect(stripe.refundsCreated[0].params).toMatchObject({ amount: 5000 });
    });

    it("takes back the salon's whole share when the rest goes back after the payout, an earlier refund included", async () => {
      // 100 € paid, 50 € refunded by the salon, then 45 € sent: the 50 € kept minus the 5 € commission.
      const id = appointment();
      supabase.seedPayment({
        appointmentId: id,
        particulierId: CLIENT_ID,
        coiffeurId: COIFFEUR_ID,
        amount: 100,
        refundedAmount: 50,
        commissionAmount: 5,
        transferId: 'tr_1',
        transferAmount: 45,
      });
      stripe.putTransfer({ id: 'tr_1', amount: 4500, transferGroup: id });

      await expect(payments.refund(id, { reason: 'admin' })).resolves.toBe(50);

      expect(stripe.reversalsCreated).toEqual([{ transferId: 'tr_1', params: { amount: 4500 } }]);
      expect(supabase.paymentFor(id)).toMatchObject({ refunded_amount: 100, reversed_amount: 45, commission_amount: 0 });
    });

    it('never takes back more than was sent, however the refunds after the payout are split', async () => {
      const id = appointment();
      supabase.seedPayment({ appointmentId: id, particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 100, transferId: 'tr_1', transferAmount: 90 });
      stripe.putTransfer({ id: 'tr_1', amount: 9000, transferGroup: id });

      for (const amount of [33.33, 33.33, 33.34]) {
        await payments.refund(id, { amount, reason: 'admin' });
      }

      expect(stripe.reversalsCreated.map((reversal) => reversal.params?.amount)).toEqual([3000, 2999, 3001]);
      expect(supabase.paymentFor(id)).toMatchObject({ refunded_amount: 100, reversed_amount: 90, commission_amount: 0 });
    });

    it("refuses a salon's refund once its payout has started, even when the transfer wasn't written down", async () => {
      const id = appointment();
      supabase.seedPayment({ appointmentId: id, particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 100, transferAttemptedAt: hoursAgo(1) });

      await expect(payments.refund(id, { reason: 'coiffeur_manual' })).rejects.toThrow(/Already paid out/);
      expect(stripe.refundsCreated).toEqual([]);
    });

    it('refunds in full a booking cancelled after a payout Stripe refused: nothing was sent, and nothing ever will be', async () => {
      const id = appointment({ status: 'cancelled' });
      supabase.seedPayment({ appointmentId: id, particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 100, transferAttemptedAt: hoursAgo(2) });

      await expect(payments.refund(id, { reason: 'admin' })).resolves.toBe(100);

      expect(stripe.reversalsCreated).toEqual([]);
      expect(supabase.paymentFor(id)).toMatchObject({ refunded_amount: 100, transfer_id: null, transfer_attempted_at: null });
    });

    it('still waits on a payout under way for a booking that is still on', async () => {
      const id = appointment();
      supabase.seedPayment({ appointmentId: id, particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 100, transferAttemptedAt: hoursAgo(1) });

      await expect(payments.refund(id, { reason: 'admin' })).rejects.toThrow(ConflictException);
      expect(stripe.refundsCreated).toEqual([]);
    });

    it("counts what Stripe already refunded, from its dashboard say, before that event arrives", async () => {
      const id = appointment();
      supabase.seedPayment({ appointmentId: id, particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 100, paymentIntentId: 'pi_1', chargeId: 'ch_1' });
      stripe.putCharge({ id: 'ch_1', paymentIntent: 'pi_1', amountRefunded: 6000 });

      await expect(payments.refund(id, { amount: 50, reason: 'coiffeur_manual' })).rejects.toThrow(/At most 40/);
      await expect(payments.refund(id, { reason: 'salon_cancelled' })).resolves.toBe(40);
      expect(supabase.paymentFor(id)).toMatchObject({ refunded_amount: 100 });
    });

    it('waits while a payout or another refund is being worked out on the same payment', async () => {
      const id = appointment();
      supabase.seedPayment({
        appointmentId: id,
        particulierId: CLIENT_ID,
        coiffeurId: COIFFEUR_ID,
        amount: 45,
        lockedUntil: new Date(Date.now() + 60_000).toISOString(),
      });

      await expect(payments.refund(id, { reason: 'coiffeur_manual' })).rejects.toThrow(ConflictException);
      expect(stripe.refundsCreated).toEqual([]);
    });

    it('takes over a lock whose holder never let go (a server that died), and lets go of its own', async () => {
      const id = appointment();
      supabase.seedPayment({
        appointmentId: id,
        particulierId: CLIENT_ID,
        coiffeurId: COIFFEUR_ID,
        amount: 45,
        lockedUntil: new Date(Date.now() - 60_000).toISOString(),
      });

      await expect(payments.refund(id, { reason: 'coiffeur_manual' })).resolves.toBe(45);
      expect(supabase.paymentFor(id)?.locked_until).toBeNull();
    });
  });

  describe('refundOwed', () => {
    it('gives back what a cancelled or refused booking still owes: a refund that failed when it happened', async () => {
      const cancelled = appointment({ status: 'cancelled' });
      const refused = appointment({ status: 'refused' });
      const alreadyRefunded = appointment({ status: 'cancelled' });
      const confirmed = appointment({ status: 'confirmed' });
      for (const id of [cancelled, refused, confirmed]) {
        supabase.seedPayment({ appointmentId: id, particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 40 });
      }
      supabase.seedPayment({ appointmentId: alreadyRefunded, particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 40, refundedAmount: 40 });

      await expect(payments.refundOwed()).resolves.toBe(2);

      expect(supabase.paymentFor(cancelled)).toMatchObject({ refunded_amount: 40 });
      expect(supabase.paymentFor(refused)).toMatchObject({ refunded_amount: 40 });
      expect(supabase.paymentFor(confirmed)).toMatchObject({ refunded_amount: 0 });
      await expect(payments.refundOwed()).resolves.toBe(0);
    });

    it('carries on past a refund Stripe refuses again, and makes it on a later run', async () => {
      const first = appointment({ status: 'cancelled' });
      const second = appointment({ status: 'cancelled' });
      for (const id of [first, second]) {
        supabase.seedPayment({ appointmentId: id, particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 40 });
      }
      stripe.failNextRefund();

      await expect(payments.refundOwed()).resolves.toBe(1);
      expect(supabase.paymentFor(first)).toMatchObject({ refunded_amount: 0, locked_until: null });
      expect(supabase.paymentFor(second)).toMatchObject({ refunded_amount: 40 });

      await expect(payments.refundOwed()).resolves.toBe(1);
      expect(supabase.paymentFor(first)).toMatchObject({ refunded_amount: 40 });
    });
  });

  describe('syncRefund', () => {
    it("records a refund made from Stripe's dashboard", async () => {
      const id = appointment();
      supabase.seedPayment({ appointmentId: id, particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 45, paymentIntentId: 'pi_x', chargeId: 'ch_x' });
      stripe.putCharge({ id: 'ch_x', paymentIntent: 'pi_x', amountRefunded: 1000 });

      await payments.syncRefund({ id: 'ch_x', payment_intent: 'pi_x', amount_refunded: 1000 } as Stripe.Charge);

      expect(supabase.paymentFor(id)).toMatchObject({ refunded_amount: 10 });
    });

    it('never lowers what was refunded when Stripe delivers an older event late, and the next refund still moves money', async () => {
      const id = appointment();
      supabase.seedPayment({ appointmentId: id, particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 100, paymentIntentId: 'pi_1', chargeId: 'ch_1' });
      stripe.putCharge({ id: 'ch_1', paymentIntent: 'pi_1' });
      await payments.refund(id, { amount: 10, reason: 'coiffeur_manual' });
      await payments.refund(id, { amount: 20, reason: 'coiffeur_manual' });

      // Stripe retries the first refund's event after the second's.
      await payments.syncRefund({ id: 'ch_1', payment_intent: 'pi_1', amount_refunded: 1000 } as Stripe.Charge);
      expect(supabase.paymentFor(id)).toMatchObject({ refunded_amount: 30 });

      await payments.refund(id, { amount: 20, reason: 'coiffeur_manual' });
      expect(stripe.refundsCreated.map((refund) => refund.params.amount)).toEqual([1000, 2000, 2000]);
      expect(supabase.paymentFor(id)).toMatchObject({ refunded_amount: 50 });
    });
  });

  describe('transferDue', () => {
    beforeEach(() => {
      supabase.seedPayoutAccount({ profileId: COIFFEUR_ID, stripeAccountId: 'acct_1', detailsSubmitted: true, payoutsEnabled: true });
    });

    it('pays the salon a day after the appointment, minus the commission', async () => {
      const id = appointment({ startsAt: hoursAgo(26) });
      const paymentId = supabase.seedPayment({
        appointmentId: id,
        particulierId: CLIENT_ID,
        coiffeurId: COIFFEUR_ID,
        amount: 100,
        commissionRate: 10,
        chargeId: 'ch_1',
      });

      await expect(payments.transferDue()).resolves.toBe(1);

      expect(stripe.transfersCreated[0]).toEqual({
        params: {
          amount: 9000,
          currency: 'eur',
          destination: 'acct_1',
          transfer_group: id,
          source_transaction: 'ch_1',
          metadata: { appointment_id: id, payment_id: paymentId },
        },
        idempotencyKey: `transfer-${paymentId}`,
      });
      expect(supabase.paymentFor(id)).toMatchObject({ transfer_id: 'tr_test_1', transfer_amount: 90, commission_amount: 10 });
      await expect(payments.transferDue()).resolves.toBe(0);
    });

    it('takes its commission on what the client kept after a partial refund', async () => {
      const id = appointment();
      supabase.seedPayment({ appointmentId: id, particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 100, refundedAmount: 20 });

      await payments.transferDue();

      expect(stripe.transfersCreated[0].params.amount).toBe(7200);
      expect(supabase.paymentFor(id)).toMatchObject({ commission_amount: 8 });
    });

    it('waits a full day, and skips refunded, cancelled and unpaid bookings', async () => {
      const recent = appointment({ startsAt: hoursAgo(3) });
      const refunded = appointment();
      const cancelled = appointment({ status: 'cancelled' });
      const unpaid = appointment();
      for (const [id, extra] of [
        [recent, {}],
        [refunded, { refundedAmount: 100 }],
        [cancelled, {}],
        [unpaid, { status: 'requires_payment' }],
      ] as const) {
        supabase.seedPayment({ appointmentId: id, particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 100, ...extra });
      }

      await expect(payments.transferDue()).resolves.toBe(0);
      expect(stripe.transfersCreated).toEqual([]);
    });

    it('never pays out a booking cancelled after the run listed it (an admin settling a dispute)', async () => {
      const id = appointment();
      supabase.seedPayment({ appointmentId: id, particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 100 });
      // Listed as due, then cancelled before its turn came.
      const listed = [supabase.paymentFor(id)];
      supabase.setAppointmentStatus(id, 'cancelled');
      jest.spyOn(supabase.client, 'rpc').mockResolvedValueOnce({ data: listed, error: null });

      await expect(payments.transferDue()).resolves.toBe(0);

      expect(stripe.transfersCreated).toEqual([]);
      expect(supabase.paymentFor(id)).toMatchObject({ transfer_attempted_at: null, locked_until: null });
    });

    it('keeps the money while the salon has no payout account (the demo salon)', async () => {
      supabase.seedPayoutAccount({ profileId: COIFFEUR_ID, stripeAccountId: null, payoutsEnabled: false, bookableWithoutPayouts: true });
      const id = appointment();
      supabase.seedPayment({ appointmentId: id, particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 100 });

      await expect(payments.transferDue()).resolves.toBe(0);
    });

    it('leaves a payment a refund is working on for the next run', async () => {
      const id = appointment();
      supabase.seedPayment({
        appointmentId: id,
        particulierId: CLIENT_ID,
        coiffeurId: COIFFEUR_ID,
        amount: 100,
        lockedUntil: new Date(Date.now() + 60_000).toISOString(),
      });

      await expect(payments.transferDue()).resolves.toBe(0);
      expect(stripe.transfersCreated).toEqual([]);
    });

    it("records a transfer an earlier run sent but couldn't write down, instead of paying twice", async () => {
      const id = appointment();
      supabase.seedPayment({ appointmentId: id, particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 100, transferAttemptedAt: hoursAgo(1) });
      stripe.putTransfer({ id: 'tr_earlier', amount: 9000, transferGroup: id });

      await expect(payments.transferDue()).resolves.toBe(1);

      expect(stripe.transfersCreated).toEqual([]);
      expect(supabase.paymentFor(id)).toMatchObject({ transfer_id: 'tr_earlier', transfer_amount: 90, commission_amount: 10 });
    });

    it("counts a refund whose Stripe event hasn't arrived before paying the salon", async () => {
      const id = appointment();
      supabase.seedPayment({ appointmentId: id, particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 100, paymentIntentId: 'pi_1', chargeId: 'ch_1' });
      stripe.putCharge({ id: 'ch_1', paymentIntent: 'pi_1', amountRefunded: 2000 });

      await payments.transferDue();

      expect(stripe.transfersCreated[0].params.amount).toBe(7200);
      expect(supabase.paymentFor(id)).toMatchObject({ refunded_amount: 20, transfer_amount: 72, commission_amount: 8 });
    });

    it('pays every salon due, however many bookings will never be paid out', async () => {
      for (let count = 0; count < 1_100; count += 1) {
        supabase.seedPayment({
          appointmentId: appointment({ status: 'cancelled' }),
          particulierId: CLIENT_ID,
          coiffeurId: COIFFEUR_ID,
          amount: 40,
          refundedAmount: 40,
        });
      }
      supabase.seedPayment({ appointmentId: appointment(), particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 100 });

      await expect(payments.transferDue()).resolves.toBe(1);
    });
  });

  describe('listForAdmin', () => {
    it('lists every payment, however many', async () => {
      for (let count = 0; count < 1_050; count += 1) {
        supabase.seedPayment({ appointmentId: appointment(), particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 40 });
      }

      await expect(payments.listForAdmin()).resolves.toHaveLength(1_050);
    });

    it('shows what the salon kept after WorldHair took part of its payout back', async () => {
      const id = appointment();
      supabase.seedPayment({
        appointmentId: id,
        particulierId: CLIENT_ID,
        coiffeurId: COIFFEUR_ID,
        amount: 100,
        refundedAmount: 50,
        commissionAmount: 5,
        transferId: 'tr_1',
        transferAmount: 90,
        reversedAmount: 45,
      });

      const [row] = await payments.listForAdmin();
      expect(row).toMatchObject({ transferAmount: 45, commissionAmount: 5 });
    });
  });
});
