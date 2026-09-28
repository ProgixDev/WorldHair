import { BadRequestException } from '@nestjs/common';
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

  describe('startPayment', () => {
    it("asks Stripe for the full price, tagged with the appointment, and keeps the day's commission rate", async () => {
      supabase.seedPlatformSettings({ commissionPercent: 12 });
      const id = appointment({ status: 'awaiting_payment' });

      const { clientSecret } = await payments.startPayment({
        appointmentId: id,
        particulierId: CLIENT_ID,
        coiffeurId: COIFFEUR_ID,
        amount: 45,
        description: 'WorldHair — Studio W',
        email: 'camille@example.com',
      });

      expect(clientSecret).toBe('pi_test_1_secret_test');
      expect(stripe.paymentIntentsCreated[0]).toMatchObject({
        params: {
          amount: 4500,
          currency: 'eur',
          automatic_payment_methods: { enabled: true },
          transfer_group: id,
          receipt_email: 'camille@example.com',
          metadata: { appointment_id: id, particulier_id: CLIENT_ID, coiffeur_id: COIFFEUR_ID },
        },
        idempotencyKey: `payment-${id}`,
      });
      expect(supabase.paymentFor(id)).toMatchObject({
        amount: 45,
        status: 'requires_payment',
        commission_rate: 12,
        commission_amount: 5.4,
        payment_intent_id: 'pi_test_1',
      });
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
  });

  it("records a refund made from Stripe's dashboard", async () => {
    const id = appointment();
    supabase.seedPayment({ appointmentId: id, particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 45, paymentIntentId: 'pi_x' });

    await payments.syncRefund({ payment_intent: 'pi_x', amount_refunded: 1000 } as Stripe.Charge);

    expect(supabase.paymentFor(id)).toMatchObject({ refunded_amount: 10 });
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

    it('keeps the money while the salon has no payout account (the demo salon)', async () => {
      supabase.seedPayoutAccount({ profileId: COIFFEUR_ID, stripeAccountId: null, payoutsEnabled: false, bookableWithoutPayouts: true });
      const id = appointment();
      supabase.seedPayment({ appointmentId: id, particulierId: CLIENT_ID, coiffeurId: COIFFEUR_ID, amount: 100 });

      await expect(payments.transferDue()).resolves.toBe(0);
    });
  });
});
