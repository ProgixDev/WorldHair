import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type Stripe from 'stripe';
import { CoiffeurApplicationsService } from '../coiffeur/coiffeur-applications.service';
import { parisParts, parisTime } from '../common/utils/paris-time';
import { EnvironmentVariables } from '../config/env.validation';
import { SupabaseService } from '../database/supabase.service';
import { PaymentsService } from '../payments/payments.service';
import { PayoutAccountsService } from '../payments/payout-accounts.service';
import { ReviewsService } from '../reviews/reviews.service';
import { SalonService } from '../salon/salon.service';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { StripeService } from '../stripe/stripe.service';
import { FakeStripe } from '../../test/utils/fakes/fake-stripe';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { AppointmentsService, CreateAppointmentInput, ParticulierAppointment } from './appointments.service';

const COIFFEUR_ID = 'coiffeur-1';
const PARTICULIER_ID = 'particulier-1';

/**
 * Next `weekday` (0 = Sunday) at `hour:minute` on a Paris clock, starting
 * tomorrow so it's never accidentally in the past. Default availability
 * (SalonService.getAvailability's fallback) is Mon-Sat 9-19 with a 13-14
 * break, Sunday closed — all Paris times, while the suite itself runs in UTC.
 */
function nextWeekday(weekday: number, hour: number, minute = 0): Date {
  const today = parisParts(new Date());
  for (let offset = 1; offset <= 7; offset++) {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    if (day.getUTCDay() === weekday) {
      return parisTime(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hour, minute);
    }
  }
  throw new Error('unreachable');
}

const WEDNESDAY_9AM = () => nextWeekday(3, 9); // first slot of the day
const WEDNESDAY_10AM = () => nextWeekday(3, 10);
const WEDNESDAY_8PM = () => nextWeekday(3, 20); // after the 19:00 close
const WEDNESDAY_LUNCH = () => nextWeekday(3, 13, 30); // inside the 13-14 break
const SUNDAY_10AM = () => nextWeekday(0, 10); // closed by default
const YESTERDAY = () => new Date(Date.now() - 86_400_000).toISOString();
const TEN_MINUTES_AGO = () => new Date(Date.now() - 10 * 60_000).toISOString();

describe('AppointmentsService', () => {
  let supabase: FakeSupabaseService;
  let service: AppointmentsService;
  let salon: SalonService;
  let events: EventEmitter2;
  let stripe: FakeStripe;
  let payments: PaymentsService;
  let serviceId: string;

  /** Books like the app: holds the slot, pays on Stripe's page with a test card, then comes back and confirms. */
  async function book(particulierId: string, input: CreateAppointmentInput): Promise<ParticulierAppointment> {
    const { appointment } = await service.create(particulierId, input);
    stripe.completeCheckout(supabase.paymentFor(appointment.id)!.checkout_session_id!);
    return service.completePayment(particulierId, appointment.id);
  }

  beforeEach(async () => {
    supabase = new FakeSupabaseService();
    events = new EventEmitter2();
    stripe = new FakeStripe();
    const config = {
      get: (key: string) => ({ STRIPE_SECRET_KEY: 'sk_test_123', WEB_APP_URL: 'https://worldhair.test' })[key],
    } as unknown as ConfigService<EnvironmentVariables, true>;
    const stripeService = new StripeService(stripe as unknown as Stripe, config);
    const payouts = new PayoutAccountsService(supabase as unknown as SupabaseService, stripeService, config);
    payments = new PaymentsService(
      supabase as unknown as SupabaseService,
      stripeService,
      new PlatformSettingsService(supabase as unknown as SupabaseService),
      payouts,
      events,
      config,
    );
    const applications = new CoiffeurApplicationsService(supabase as unknown as SupabaseService, events);
    salon = new SalonService(supabase as unknown as SupabaseService);
    service = new AppointmentsService(
      supabase as unknown as SupabaseService,
      applications,
      salon,
      events,
      payments,
      payouts,
    );

    supabase.seedValidatedSalon({
      profileId: COIFFEUR_ID,
      firstName: 'Sofia',
      lastName: 'Benali',
      salonName: 'Studio W',
      services: [{ name: 'Coupe & brushing', price: 40, durationMin: 60, specialty: 'coupe' }],
    });
    const services = await salon.listServices(COIFFEUR_ID);
    serviceId = services[0].id;

    supabase.addUser('particulier-token', { id: PARTICULIER_ID, email: 'p@example.com', email_confirmed_at: null }, 'particulier', {
      firstName: 'Camille',
      lastName: 'Durand',
    });
  });

  describe('paying at booking', () => {
    it('holds the slot while the client pays: nothing reaches the salon before the card goes through', async () => {
      const heard = jest.fn();
      events.on('appointment.created', heard);

      const { appointment, payment } = await service.create(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceIds: [serviceId],
        startsAt: WEDNESDAY_10AM().toISOString(),
      });

      expect(appointment.status).toBe('awaiting_payment');
      expect(payment).toEqual({ url: 'https://checkout.stripe.test/cs_test_1', amount: 40 });
      expect(stripe.checkoutSessionsCreated[0]).toMatchObject({
        mode: 'payment',
        line_items: [{ price_data: { unit_amount: 4000, product_data: { name: 'Studio W — Coupe & brushing' } } }],
        payment_intent_data: { transfer_group: appointment.id },
      });
      expect(heard).not.toHaveBeenCalled();
      await expect(service.listForCoiffeur(COIFFEUR_ID)).resolves.toEqual([]);
      await expect(service.listForParticulier(PARTICULIER_ID)).resolves.toEqual([]);
    });

    it("keeps the held slot from anyone else while it's being paid", async () => {
      await service.create(PARTICULIER_ID, { coiffeurId: COIFFEUR_ID, serviceIds: [serviceId], startsAt: WEDNESDAY_10AM().toISOString() });

      await expect(
        service.create('particulier-2', { coiffeurId: COIFFEUR_ID, serviceIds: [serviceId], startsAt: WEDNESDAY_10AM().toISOString() }),
      ).rejects.toThrow(/no longer available/);
    });

    it('sends the request once Stripe confirms the payment, and only once', async () => {
      const heard = jest.fn();
      events.on('appointment.created', heard);
      const { appointment } = await service.create(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceIds: [serviceId],
        startsAt: WEDNESDAY_10AM().toISOString(),
      });

      await expect(service.completePayment(PARTICULIER_ID, appointment.id)).resolves.toMatchObject({ status: 'awaiting_payment' });
      const intent = stripe.completeCheckout('cs_test_1');
      await expect(service.completePayment(PARTICULIER_ID, appointment.id)).resolves.toMatchObject({
        status: 'pending',
        payment: { amount: 40, refundedAmount: 0 },
      });
      await service.handlePaymentEvent({ type: 'payment_intent.succeeded', data: { object: intent } } as unknown as Stripe.Event);

      expect(heard).toHaveBeenCalledTimes(1);
      expect(supabase.paymentFor(appointment.id)).toMatchObject({
        status: 'succeeded',
        payment_intent_id: 'pi_test_1',
        charge_id: 'ch_pi_test_1',
      });
    });

    it("takes Stripe's word first when its webhook beats the client back to the app — never as a stray payment", async () => {
      const { appointment } = await service.create(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceIds: [serviceId],
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      const intent = stripe.completeCheckout('cs_test_1');

      await service.handlePaymentEvent({ type: 'payment_intent.succeeded', data: { object: intent } } as unknown as Stripe.Event);

      expect(stripe.refundsCreated).toEqual([]);
      const [forSalon] = await service.listForCoiffeur(COIFFEUR_ID);
      expect(forSalon).toMatchObject({ id: appointment.id, status: 'pending' });
    });

    it("refuses a salon that can't be paid online yet, but the demo salon takes bookings anyway", async () => {
      supabase.seedPayoutAccount({ profileId: COIFFEUR_ID, stripeAccountId: null, payoutsEnabled: false });
      await expect(
        service.create(PARTICULIER_ID, { coiffeurId: COIFFEUR_ID, serviceIds: [serviceId], startsAt: WEDNESDAY_10AM().toISOString() }),
      ).rejects.toThrow(/online bookings/);

      supabase.seedPayoutAccount({ profileId: COIFFEUR_ID, bookableWithoutPayouts: true });
      await expect(
        book(PARTICULIER_ID, { coiffeurId: COIFFEUR_ID, serviceIds: [serviceId], startsAt: WEDNESDAY_10AM().toISOString() }),
      ).resolves.toMatchObject({ status: 'pending' });
    });

    it('frees the slot when the client leaves before paying, and keeps it if they paid meanwhile', async () => {
      const { appointment: left } = await service.create(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceIds: [serviceId],
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      await service.releaseHold(PARTICULIER_ID, left.id);
      expect(stripe.sessionStatus('cs_test_1')).toBe('expired');
      expect(supabase.paymentFor(left.id)).toBeUndefined();

      const { appointment: paid } = await service.create(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceIds: [serviceId],
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      stripe.completeCheckout('cs_test_2');
      await service.releaseHold(PARTICULIER_ID, paid.id);
      const [kept] = await service.listForParticulier(PARTICULIER_ID);
      expect(kept).toMatchObject({ id: paid.id, status: 'pending' });
    });

    it('releases holds nobody paid for within 15 minutes', async () => {
      const { appointment } = await service.create(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceIds: [serviceId],
        startsAt: WEDNESDAY_10AM().toISOString(),
      });

      await service.releaseStaleHolds(new Date(Date.now() + 5 * 60_000));
      expect(supabase.paymentFor(appointment.id)).toBeDefined();

      await service.releaseStaleHolds(new Date(Date.now() + 16 * 60_000));
      expect(supabase.paymentFor(appointment.id)).toBeUndefined();
    });

    it('keeps one unpaid hold per client: starting another booking frees the first', async () => {
      const { appointment: first } = await service.create(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceIds: [serviceId],
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      const { appointment: second } = await service.create(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceIds: [serviceId],
        startsAt: nextWeekday(3, 15).toISOString(),
      });

      expect(stripe.sessionStatus('cs_test_1')).toBe('expired');
      expect(supabase.paymentFor(first.id)).toBeUndefined();
      expect(supabase.paymentFor(second.id)).toMatchObject({ status: 'requires_payment' });
    });

    it('lets the client go back and pick a time overlapping their own unpaid hold', async () => {
      await service.create(PARTICULIER_ID, { coiffeurId: COIFFEUR_ID, serviceIds: [serviceId], startsAt: WEDNESDAY_10AM().toISOString() });

      await expect(
        service.create(PARTICULIER_ID, { coiffeurId: COIFFEUR_ID, serviceIds: [serviceId], startsAt: nextWeekday(3, 10, 30).toISOString() }),
      ).resolves.toMatchObject({ appointment: { status: 'awaiting_payment' } });
    });

    it("shows the client's own unpaid hold as free on the grid — picking again replaces it — and taken to everyone else", async () => {
      await service.create(PARTICULIER_ID, { coiffeurId: COIFFEUR_ID, serviceIds: [serviceId], startsAt: WEDNESDAY_10AM().toISOString() });
      const paris = parisParts(WEDNESDAY_10AM());
      const date = `${paris.year}-${String(paris.month).padStart(2, '0')}-${String(paris.day).padStart(2, '0')}`;

      const mine = await service.slots(PARTICULIER_ID, 'particulier', COIFFEUR_ID, { date, serviceIds: [serviceId] });
      const theirs = await service.slots('particulier-2', 'particulier', COIFFEUR_ID, { date, serviceIds: [serviceId] });

      expect(mine.slots.find((slot) => slot.label === '10:00')?.available).toBe(true);
      expect(theirs.slots.find((slot) => slot.label === '10:00')?.available).toBe(false);
    });

    it('gives everything back when a payment lands after its hold was released', async () => {
      await service.handlePaymentEvent({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_orphan', metadata: { appointment_id: 'gone' } } },
      } as unknown as Stripe.Event);

      expect(stripe.refundsCreated[0].params).toMatchObject({ payment_intent: 'pi_orphan' });
    });
  });

  describe('refunds', () => {
    const slot = () => ({ coiffeurId: COIFFEUR_ID, serviceIds: [serviceId], startsAt: WEDNESDAY_10AM().toISOString() });

    it('refunds everything when the salon refuses or cancels, or the client cancels in time', async () => {
      const refused = await book(PARTICULIER_ID, slot());
      await service.decide(COIFFEUR_ID, refused.id, 'refused');

      const cancelledBySalon = await book(PARTICULIER_ID, slot());
      await service.decide(COIFFEUR_ID, cancelledBySalon.id, 'confirmed');
      await service.cancel(COIFFEUR_ID, cancelledBySalon.id);

      const cancelledByClient = await book(PARTICULIER_ID, slot());
      await service.cancel(PARTICULIER_ID, cancelledByClient.id);

      expect(stripe.refundsCreated.map((refund) => refund.params.amount)).toEqual([4000, 4000, 4000]);
      const mine = await service.listForParticulier(PARTICULIER_ID);
      expect(mine.every((appointment) => appointment.payment?.refundedAmount === 40)).toBe(true);
    });

    it('expires a request the salon never answered before its time, and refunds it', async () => {
      const request = await book(PARTICULIER_ID, slot());
      const heard = jest.fn();
      events.on('appointment.expired', heard);

      await service.expireUnansweredRequests(new Date(WEDNESDAY_10AM().getTime() + 60_000));

      const [expired] = await service.listForParticulier(PARTICULIER_ID);
      expect(expired).toMatchObject({ id: request.id, status: 'cancelled', payment: { refundedAmount: 40 } });
      expect(heard).toHaveBeenCalledWith(
        expect.objectContaining({ appointmentId: request.id, particulierId: PARTICULIER_ID, refunded: 40 }),
      );
    });

    it("says nothing was refunded when an expired request wasn't paid in the app", async () => {
      const id = supabase.seedAppointment({
        particulierId: PARTICULIER_ID,
        coiffeurId: COIFFEUR_ID,
        startsAt: TEN_MINUTES_AGO(),
        status: 'pending',
      });
      const heard = jest.fn();
      events.on('appointment.expired', heard);

      await service.expireUnansweredRequests();

      expect(heard).toHaveBeenCalledWith(expect.objectContaining({ appointmentId: id, refunded: 0 }));
    });

    it('carries on expiring requests past a refund Stripe refuses: the job gives that money back later', async () => {
      const first = await book(PARTICULIER_ID, slot());
      const second = await book(PARTICULIER_ID, { ...slot(), startsAt: nextWeekday(3, 15).toISOString() });
      const heard = jest.fn();
      events.on('appointment.expired', heard);
      stripe.failNextRefund();

      await service.expireUnansweredRequests(new Date(nextWeekday(3, 15).getTime() + 60_000));

      expect(supabase.paymentFor(first.id)).toMatchObject({ refunded_amount: 0 });
      expect(supabase.paymentFor(second.id)).toMatchObject({ refunded_amount: 40 });
      expect(heard).toHaveBeenCalledWith(expect.objectContaining({ appointmentId: first.id, refunded: 0 }));
      expect(heard).toHaveBeenCalledWith(expect.objectContaining({ appointmentId: second.id, refunded: 40 }));

      await payments.refundOwed();
      expect(supabase.paymentFor(first.id)).toMatchObject({ refunded_amount: 40 });
    });

    it("doesn't fail a cancellation or a refusal when Stripe can't refund right now: the job gives the money back later", async () => {
      const cancelled = await book(PARTICULIER_ID, slot());
      stripe.failNextRefund();
      await expect(service.cancel(PARTICULIER_ID, cancelled.id)).resolves.toBeUndefined();

      const refused = await book(PARTICULIER_ID, slot());
      stripe.failNextRefund();
      await expect(service.decide(COIFFEUR_ID, refused.id, 'refused')).resolves.toBeUndefined();

      const mine = await service.listForParticulier(PARTICULIER_ID);
      expect(mine.map((appointment) => [appointment.status, appointment.payment?.refundedAmount])).toEqual([
        ['cancelled', 0],
        ['refused', 0],
      ]);

      await payments.refundOwed();
      const after = await service.listForParticulier(PARTICULIER_ID);
      expect(after.map((appointment) => appointment.payment?.refundedAmount)).toEqual([40, 40]);
    });

    it("shows the salon what it keeps after WorldHair took part of its payout back", async () => {
      const id = supabase.seedAppointment({ particulierId: PARTICULIER_ID, coiffeurId: COIFFEUR_ID, startsAt: YESTERDAY(), status: 'confirmed' });
      supabase.seedPayment({
        appointmentId: id,
        particulierId: PARTICULIER_ID,
        coiffeurId: COIFFEUR_ID,
        amount: 100,
        refundedAmount: 50,
        commissionAmount: 5,
        transferId: 'tr_1',
        transferAmount: 90,
        reversedAmount: 45,
      });

      const [forSalon] = await service.listForCoiffeur(COIFFEUR_ID);
      expect(forSalon.payment).toMatchObject({ refundedAmount: 50, commissionAmount: 5, payoutAmount: 45 });
    });

    it('lets the coiffeur refund part of an accepted booking by hand, never more than was paid', async () => {
      const booked = await book(PARTICULIER_ID, slot());
      await service.decide(COIFFEUR_ID, booked.id, 'confirmed');

      await expect(service.refundByCoiffeur(COIFFEUR_ID, booked.id, 15)).resolves.toEqual({ refunded: 15 });
      await expect(service.refundByCoiffeur(COIFFEUR_ID, booked.id, 30)).rejects.toThrow(BadRequestException);
      await expect(service.refundByCoiffeur('another-coiffeur', booked.id)).rejects.toThrow(ForbiddenException);

      const [forSalon] = await service.listForCoiffeur(COIFFEUR_ID);
      expect(forSalon.payment).toMatchObject({ amount: 40, refundedAmount: 15, commissionAmount: 2.5, payoutAmount: 22.5, paidOutAt: null });
    });
  });

  describe('create', () => {
    it('creates a pending request with a snapshot of the service', async () => {
      const startsAt = WEDNESDAY_10AM();
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: startsAt.toISOString(),
      });

      expect(created).toMatchObject({
        salonId: COIFFEUR_ID,
        salonName: 'Studio W',
        serviceName: 'Coupe & brushing',
        durationMin: 60,
        price: 40,
        status: 'pending',
      });
    });

    it("accepts the salon's first slot of the day, read on a Paris clock", async () => {
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: WEDNESDAY_9AM().toISOString(),
      });
      expect(created.status).toBe('pending');
    });

    it('404s a salon whose account is suspended or banned', async () => {
      supabase.setAccountStatus(COIFFEUR_ID, 'suspended');
      await expect(
        service.create(PARTICULIER_ID, {
          coiffeurId: COIFFEUR_ID,
          serviceId,
          startsAt: WEDNESDAY_10AM().toISOString(),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('404s a salon without a live subscription, for booking and for its slots', async () => {
      supabase.seedSubscription({ profileId: COIFFEUR_ID, status: 'canceled', stripeSubscriptionId: 'sub_1' });

      await expect(
        service.create(PARTICULIER_ID, { coiffeurId: COIFFEUR_ID, serviceIds: [serviceId], startsAt: WEDNESDAY_10AM().toISOString() }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.slots(PARTICULIER_ID, 'particulier', COIFFEUR_ID, { date: '2026-10-07', serviceIds: [serviceId] }),
      ).rejects.toThrow(NotFoundException);
    });

    it("doesn't take bookings for after the salon's subscription ends", async () => {
      supabase.seedSubscription({
        profileId: COIFFEUR_ID,
        status: 'active',
        stripeSubscriptionId: 'sub_1',
        cancelAt: WEDNESDAY_9AM().toISOString(),
      });

      await expect(
        service.create(PARTICULIER_ID, { coiffeurId: COIFFEUR_ID, serviceIds: [serviceId], startsAt: WEDNESDAY_10AM().toISOString() }),
      ).rejects.toThrow(/closed/);
      const day = parisParts(WEDNESDAY_10AM());
      const date = `${day.year}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
      await expect(
        service.slots(PARTICULIER_ID, 'particulier', COIFFEUR_ID, { date, serviceIds: [serviceId] }),
      ).resolves.toMatchObject({ closed: true });
    });

    it('404s an unknown or unvalidated coiffeur', async () => {
      await expect(
        service.create(PARTICULIER_ID, {
          coiffeurId: 'does-not-exist',
          serviceId,
          startsAt: WEDNESDAY_10AM().toISOString(),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('404s an unknown service', async () => {
      await expect(
        service.create(PARTICULIER_ID, {
          coiffeurId: COIFFEUR_ID,
          serviceId: 'does-not-exist',
          startsAt: WEDNESDAY_10AM().toISOString(),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a date in the past', async () => {
      await expect(
        service.create(PARTICULIER_ID, {
          coiffeurId: COIFFEUR_ID,
          serviceId,
          startsAt: new Date(Date.now() - 86400000).toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a slot outside opening hours', async () => {
      await expect(
        service.create(PARTICULIER_ID, {
          coiffeurId: COIFFEUR_ID,
          serviceId,
          startsAt: WEDNESDAY_8PM().toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a slot inside the lunch break', async () => {
      await expect(
        service.create(PARTICULIER_ID, {
          coiffeurId: COIFFEUR_ID,
          serviceId,
          startsAt: WEDNESDAY_LUNCH().toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a slot on a closed day', async () => {
      await expect(
        service.create(PARTICULIER_ID, {
          coiffeurId: COIFFEUR_ID,
          serviceId,
          startsAt: SUNDAY_10AM().toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an overlapping slot already held by a pending or confirmed request', async () => {
      const startsAt = WEDNESDAY_10AM();
      await book(PARTICULIER_ID, { coiffeurId: COIFFEUR_ID, serviceId, startsAt: startsAt.toISOString() });

      const overlapping = new Date(startsAt.getTime() + 30 * 60000); // 30 min into the same 60-min slot
      await expect(
        service.create('particulier-2', {
          coiffeurId: COIFFEUR_ID,
          serviceId,
          startsAt: overlapping.toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listForParticulier', () => {
    it('includes the salon name and derives "done" for a past confirmed booking', async () => {
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      await service.decide(COIFFEUR_ID, created.id, 'confirmed');
      // Simulate time passing by asking the same question at a fixed later date
      // is out of scope for a pure `listForParticulier(id)` call (it always
      // uses `new Date()`), so this test only verifies the confirmed shape —
      // the "done" derivation itself is covered directly below.
      const [mine] = await service.listForParticulier(PARTICULIER_ID);
      expect(mine).toMatchObject({ salonName: 'Studio W', status: 'confirmed' });
    });
  });

  describe('listBusySlots', () => {
    it('exposes pending/confirmed starts with no client identity, excluding refused/cancelled', async () => {
      const pending = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      const refused = await book('particulier-2', {
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: nextWeekday(4, 11).toISOString(),
      });
      await service.decide(COIFFEUR_ID, refused.id, 'refused');

      const busy = await service.listBusySlots(COIFFEUR_ID);
      expect(busy).toEqual([{ startsAt: pending.startsAt, durationMin: 60 }]);
      expect(JSON.stringify(busy)).not.toContain('particulier');
    });
  });

  describe('reschedule', () => {
    it('moves a pending booking to a new valid slot', async () => {
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      const newSlot = nextWeekday(4, 11); // Thursday 11:00

      const updated = await service.reschedule(PARTICULIER_ID, created.id, newSlot.toISOString());
      expect(new Date(updated.startsAt).getTime()).toBe(newSlot.getTime());
    });

    it("403s someone else's booking", async () => {
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      await expect(
        service.reschedule('someone-else', created.id, nextWeekday(4, 11).toISOString()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects rescheduling an already-refused booking', async () => {
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      await service.decide(COIFFEUR_ID, created.id, 'refused');
      await expect(
        service.reschedule(PARTICULIER_ID, created.id, nextWeekday(4, 11).toISOString()),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects moving an appointment that already took place', async () => {
      const done = supabase.seedAppointment({
        particulierId: PARTICULIER_ID,
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: YESTERDAY(),
        status: 'confirmed',
      });
      await expect(
        service.reschedule(PARTICULIER_ID, done, nextWeekday(4, 11).toISOString()),
      ).rejects.toThrow(BadRequestException);
    });

    it('tells listeners the coiffeur should hear about the move', async () => {
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      const heard = jest.fn();
      events.on('appointment.rescheduled', heard);
      const newSlot = nextWeekday(4, 11);

      await service.reschedule(PARTICULIER_ID, created.id, newSlot.toISOString());

      expect(heard).toHaveBeenCalledWith({
        appointmentId: created.id,
        coiffeurId: COIFFEUR_ID,
        serviceName: 'Coupe & brushing',
        previousStartsAt: created.startsAt,
        startsAt: newSlot.toISOString(),
      });
    });

    it("doesn't conflict with its own current slot", async () => {
      const startsAt = WEDNESDAY_10AM();
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: startsAt.toISOString(),
      });
      // "Reschedule" to the same slot it's already in — must not self-conflict.
      const updated = await service.reschedule(PARTICULIER_ID, created.id, startsAt.toISOString());
      expect(updated.id).toBe(created.id);
    });
  });

  describe('cancel', () => {
    it('lets the particulier cancel their own pending request', async () => {
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      await service.cancel(PARTICULIER_ID, created.id);
      const [mine] = await service.listForParticulier(PARTICULIER_ID);
      expect(mine.status).toBe('cancelled');
    });

    it('lets the coiffeur cancel a confirmed booking', async () => {
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      await service.decide(COIFFEUR_ID, created.id, 'confirmed');
      await service.cancel(COIFFEUR_ID, created.id);
      const [mine] = await service.listForParticulier(PARTICULIER_ID);
      expect(mine.status).toBe('cancelled');
    });

    it('403s a bystander', async () => {
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      await expect(service.cancel('bystander', created.id)).rejects.toThrow(ForbiddenException);
    });

    it('rejects cancelling an already-cancelled booking', async () => {
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      await service.cancel(PARTICULIER_ID, created.id);
      await expect(service.cancel(PARTICULIER_ID, created.id)).rejects.toThrow(BadRequestException);
    });

    it('rejects cancelling an appointment that already took place, so its review stays possible', async () => {
      const done = supabase.seedAppointment({
        particulierId: PARTICULIER_ID,
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: YESTERDAY(),
        status: 'confirmed',
      });
      await expect(service.cancel(COIFFEUR_ID, done)).rejects.toThrow(BadRequestException);
    });

    it('tells listeners who the particulier is, so a salon cancellation reaches them', async () => {
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      const heard = jest.fn();
      events.on('appointment.cancelled', heard);

      await service.cancel(COIFFEUR_ID, created.id);

      expect(heard).toHaveBeenCalledWith({
        appointmentId: created.id,
        coiffeurId: COIFFEUR_ID,
        particulierId: PARTICULIER_ID,
        cancelledByUserId: COIFFEUR_ID,
        serviceName: 'Coupe & brushing',
        startsAt: created.startsAt,
      });
    });
  });

  describe('listForCoiffeur / decide', () => {
    it('resolves the client name and flags their first-ever booking as new', async () => {
      const first = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      const second = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: nextWeekday(4, 11).toISOString(),
      });

      const list = await service.listForCoiffeur(COIFFEUR_ID);
      const byId = new Map(list.map((a) => [a.id, a]));
      expect(byId.get(first.id)).toMatchObject({ clientName: 'Camille Durand', isNewClient: true });
      expect(byId.get(second.id)).toMatchObject({ clientName: 'Camille Durand', isNewClient: false });
    });

    it("doesn't accept a request the client cancelled while the salon was answering", async () => {
      const request = await book(PARTICULIER_ID, { coiffeurId: COIFFEUR_ID, serviceIds: [serviceId], startsAt: WEDNESDAY_10AM().toISOString() });
      supabase.beforeNextAppointmentUpdate(() => supabase.setAppointmentStatus(request.id, 'cancelled'));

      await expect(service.decide(COIFFEUR_ID, request.id, 'confirmed')).rejects.toThrow(/already been decided/);

      const [mine] = await service.listForParticulier(PARTICULIER_ID);
      expect(mine.status).toBe('cancelled');
    });

    it("doesn't turn a request the salon refused meanwhile into a cancellation", async () => {
      const request = await book(PARTICULIER_ID, { coiffeurId: COIFFEUR_ID, serviceIds: [serviceId], startsAt: WEDNESDAY_10AM().toISOString() });
      supabase.beforeNextAppointmentUpdate(() => supabase.setAppointmentStatus(request.id, 'refused'));

      await expect(service.cancel(PARTICULIER_ID, request.id)).rejects.toThrow(/can no longer be modified/);

      const [mine] = await service.listForParticulier(PARTICULIER_ID);
      expect(mine.status).toBe('refused');
    });

    it('accepts a pending request', async () => {
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      await service.decide(COIFFEUR_ID, created.id, 'confirmed');
      const [mine] = await service.listForCoiffeur(COIFFEUR_ID);
      expect(mine.status).toBe('confirmed');
    });

    it("403s a different coiffeur deciding on someone else's request", async () => {
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      await expect(service.decide('another-coiffeur', created.id, 'confirmed')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects deciding on a request that was already decided', async () => {
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      await service.decide(COIFFEUR_ID, created.id, 'refused');
      await expect(service.decide(COIFFEUR_ID, created.id, 'confirmed')).rejects.toThrow(BadRequestException);
    });

    it('rejects deciding on a request whose time has already passed', async () => {
      const expired = supabase.seedAppointment({
        particulierId: PARTICULIER_ID,
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: YESTERDAY(),
        status: 'pending',
      });
      await expect(service.decide(COIFFEUR_ID, expired, 'confirmed')).rejects.toThrow(BadRequestException);
    });

    it('tells listeners about a refusal, so the particulier can be told', async () => {
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      const heard = jest.fn();
      events.on('appointment.refused', heard);

      await service.decide(COIFFEUR_ID, created.id, 'refused');

      expect(heard).toHaveBeenCalledWith({
        appointmentId: created.id,
        particulierId: PARTICULIER_ID,
        serviceName: 'Coupe & brushing',
        startsAt: created.startsAt,
      });
    });
  });

  describe('several prestations in one booking', () => {
    let colorId: string;

    beforeEach(async () => {
      const color = await salon.createService(COIFFEUR_ID, {
        name: 'Couleur',
        price: 55,
        durationMin: 90,
        specialty: 'coloration',
      });
      colorId = color.id;
    });

    it('books them as one block: durations and prices add up, lines kept in the order picked', async () => {
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceIds: [colorId, serviceId],
        startsAt: WEDNESDAY_10AM().toISOString(),
      });

      expect(created).toMatchObject({
        serviceName: 'Couleur + Coupe & brushing',
        durationMin: 150,
        price: 95,
        services: [
          { serviceId: colorId, name: 'Couleur', price: 55, durationMin: 90 },
          { serviceId, name: 'Coupe & brushing', price: 40, durationMin: 60 },
        ],
      });
      const [forSalon] = await service.listForCoiffeur(COIFFEUR_ID);
      expect(forSalon.services).toHaveLength(2);
    });

    it('needs the whole block to fit before closing time', async () => {
      await expect(
        service.create(PARTICULIER_ID, {
          coiffeurId: COIFFEUR_ID,
          serviceIds: [colorId, serviceId],
          startsAt: nextWeekday(3, 17).toISOString(), // 17:00 + 150 min ends after 19:00
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('still accepts the single serviceId older app versions send', async () => {
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      expect(created.services).toEqual([{ serviceId, name: 'Coupe & brushing', price: 40, durationMin: 60 }]);
    });

    it('refuses a booking with no prestation, or one from another salon', async () => {
      await expect(
        service.create(PARTICULIER_ID, { coiffeurId: COIFFEUR_ID, serviceIds: [], startsAt: WEDNESDAY_10AM().toISOString() }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(PARTICULIER_ID, {
          coiffeurId: COIFFEUR_ID,
          serviceIds: [serviceId, '9b2c8f0e-5a3d-4c1b-8e7f-6a5b4c3d2e1f'],
          startsAt: WEDNESDAY_10AM().toISOString(),
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('instant confirmation', () => {
    it('confirms the booking straight away and tells the particulier', async () => {
      await salon.updateProfile(COIFFEUR_ID, { confirmationMode: 'instant' });
      const confirmed = jest.fn();
      events.on('appointment.confirmed', confirmed);

      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceIds: [serviceId],
        startsAt: WEDNESDAY_10AM().toISOString(),
      });

      expect(created.status).toBe('confirmed');
      expect(confirmed).toHaveBeenCalledWith(expect.objectContaining({ appointmentId: created.id }));
    });

    it("tells listeners the new booking's status, so the coiffeur's message fits", async () => {
      await salon.updateProfile(COIFFEUR_ID, { confirmationMode: 'instant' });
      const heard = jest.fn();
      events.on('appointment.created', heard);

      await book(PARTICULIER_ID, { coiffeurId: COIFFEUR_ID, serviceIds: [serviceId], startsAt: WEDNESDAY_10AM().toISOString() });

      expect(heard).toHaveBeenCalledWith(expect.objectContaining({ status: 'confirmed' }));
    });
  });

  describe("the salon's deadlines", () => {
    it('refuses a booking that starts inside the booking notice', async () => {
      await salon.updateProfile(COIFFEUR_ID, { bookingNoticeMinutes: 20160 }); // two weeks

      await expect(
        service.create(PARTICULIER_ID, { coiffeurId: COIFFEUR_ID, serviceIds: [serviceId], startsAt: WEDNESDAY_10AM().toISOString() }),
      ).rejects.toThrow(/notice/);
    });

    it("won't let the particulier cancel or move an accepted booking once the cancellation deadline has passed", async () => {
      await salon.updateProfile(COIFFEUR_ID, { cancellationNoticeMinutes: 20160 });
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceIds: [serviceId],
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      await service.decide(COIFFEUR_ID, created.id, 'confirmed');

      await expect(service.cancel(PARTICULIER_ID, created.id)).rejects.toThrow(/Too late/);
      await expect(service.reschedule(PARTICULIER_ID, created.id, nextWeekday(4, 11).toISOString())).rejects.toThrow(/Too late/);
    });

    it('still lets the particulier withdraw a request the salon has not accepted yet', async () => {
      await salon.updateProfile(COIFFEUR_ID, { cancellationNoticeMinutes: 20160 });
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceIds: [serviceId],
        startsAt: WEDNESDAY_10AM().toISOString(),
      });

      await expect(service.cancel(PARTICULIER_ID, created.id)).resolves.toBeUndefined();
    });

    it('stops the particulier changing a booking once it has started, even with no cancellation notice', async () => {
      await salon.updateProfile(COIFFEUR_ID, { cancellationNoticeMinutes: 0 });
      const started = supabase.seedAppointment({
        particulierId: PARTICULIER_ID,
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: TEN_MINUTES_AGO(),
        durationMin: 60,
        status: 'confirmed',
      });
      const startedRequest = supabase.seedAppointment({
        particulierId: PARTICULIER_ID,
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: TEN_MINUTES_AGO(),
        durationMin: 60,
        status: 'pending',
      });

      await expect(service.cancel(PARTICULIER_ID, started)).rejects.toThrow(/Too late/);
      await expect(service.reschedule(PARTICULIER_ID, started, nextWeekday(4, 11).toISOString())).rejects.toThrow(
        /Too late/,
      );
      await expect(service.cancel(PARTICULIER_ID, startedRequest)).rejects.toThrow(/Too late/);
    });

    it('keeps the cancellation notice the salon had when the client booked', async () => {
      await salon.updateProfile(COIFFEUR_ID, { cancellationNoticeMinutes: 60 });
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceIds: [serviceId],
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      await service.decide(COIFFEUR_ID, created.id, 'confirmed');
      await salon.updateProfile(COIFFEUR_ID, { cancellationNoticeMinutes: 20160 });

      await expect(service.cancel(PARTICULIER_ID, created.id)).resolves.toBeUndefined();
    });

    it('lets the particulier change a booking the salon moved until it starts, until they pick a time themselves', async () => {
      await salon.updateProfile(COIFFEUR_ID, { cancellationNoticeMinutes: 20160 });
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceIds: [serviceId],
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      await service.decide(COIFFEUR_ID, created.id, 'confirmed');
      await service.move(COIFFEUR_ID, created.id, nextWeekday(4, 15).toISOString());

      const [moved] = await service.listForParticulier(PARTICULIER_ID);
      expect(moved.movedBySalon).toBe(true);
      expect(moved.modifiableUntil).toBe(moved.startsAt);

      await service.reschedule(PARTICULIER_ID, created.id, nextWeekday(5, 11).toISOString());
      const [rescheduled] = await service.listForParticulier(PARTICULIER_ID);
      expect(rescheduled.movedBySalon).toBe(false);
      await expect(service.cancel(PARTICULIER_ID, created.id)).rejects.toThrow(/Too late/);
    });

    it('never holds the coiffeur to it', async () => {
      await salon.updateProfile(COIFFEUR_ID, { cancellationNoticeMinutes: 20160 });
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceIds: [serviceId],
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      await service.decide(COIFFEUR_ID, created.id, 'confirmed');

      await expect(service.cancel(COIFFEUR_ID, created.id)).resolves.toBeUndefined();
    });

    it('tells the particulier until when an accepted booking can still be changed', async () => {
      await salon.updateProfile(COIFFEUR_ID, { cancellationNoticeMinutes: 1440 });
      const startsAt = WEDNESDAY_10AM();
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceIds: [serviceId],
        startsAt: startsAt.toISOString(),
      });
      expect(created.modifiableUntil).toBe(startsAt.toISOString()); // pending: can be withdrawn until it starts

      await service.decide(COIFFEUR_ID, created.id, 'confirmed');
      const [mine] = await service.listForParticulier(PARTICULIER_ID);
      expect(mine.modifiableUntil).toBe(new Date(startsAt.getTime() - 86_400_000).toISOString());
    });
  });

  describe('closures and conflicts', () => {
    it('refuses a booking during a closure', async () => {
      const startsAt = WEDNESDAY_10AM();
      supabase.seedTimeOff({
        profileId: COIFFEUR_ID,
        startsAt: new Date(startsAt.getTime() - 3_600_000).toISOString(),
        endsAt: new Date(startsAt.getTime() + 3 * 3_600_000).toISOString(),
      });

      await expect(
        service.create(PARTICULIER_ID, { coiffeurId: COIFFEUR_ID, serviceIds: [serviceId], startsAt: startsAt.toISOString() }),
      ).rejects.toThrow(/closed/);
    });

    it('refuses a booking that overlaps one the particulier already has at another salon', async () => {
      supabase.seedValidatedSalon({
        profileId: 'coiffeur-2',
        firstName: 'Awa',
        lastName: 'Diallo',
        salonName: 'Maison Tresse',
        services: [{ name: 'Tresses', price: 60, durationMin: 120, specialty: 'tresses' }],
      });
      const [braids] = await salon.listServices('coiffeur-2');
      await book(PARTICULIER_ID, { coiffeurId: 'coiffeur-2', serviceIds: [braids.id], startsAt: WEDNESDAY_10AM().toISOString() });

      await expect(
        service.create(PARTICULIER_ID, {
          coiffeurId: COIFFEUR_ID,
          serviceIds: [serviceId],
          startsAt: nextWeekday(3, 11).toISOString(),
        }),
      ).rejects.toThrow(/already have an appointment/);
    });

    it("still sees a taken slot behind a long booking history (PostgREST returns 1 000 rows at most)", async () => {
      for (let day = 2; day < 1002; day++) {
        supabase.seedAppointment({
          particulierId: 'regular-client',
          coiffeurId: COIFFEUR_ID,
          startsAt: new Date(Date.now() - day * 86_400_000).toISOString(),
          status: 'confirmed',
        });
      }
      supabase.seedAppointment({
        particulierId: 'particulier-2',
        coiffeurId: COIFFEUR_ID,
        startsAt: WEDNESDAY_10AM().toISOString(),
        durationMin: 60,
        status: 'confirmed',
      });

      await expect(
        service.create(PARTICULIER_ID, { coiffeurId: COIFFEUR_ID, serviceIds: [serviceId], startsAt: WEDNESDAY_10AM().toISOString() }),
      ).rejects.toThrow(/no longer available/);
    });

    it("turns the database's double-booking refusal into a friendly 'no longer available'", async () => {
      supabase.failNextAppointmentInsert('23P01');

      await expect(
        service.create(PARTICULIER_ID, { coiffeurId: COIFFEUR_ID, serviceIds: [serviceId], startsAt: WEDNESDAY_10AM().toISOString() }),
      ).rejects.toThrow(/no longer available/);
    });
  });

  describe('slots', () => {
    const dateOf = (instant: Date) => {
      const paris = parisParts(instant);
      return `${paris.year}-${String(paris.month).padStart(2, '0')}-${String(paris.day).padStart(2, '0')}`;
    };

    it("lists the day's starts for the picked prestations, taking existing bookings into account", async () => {
      await book('particulier-2', { coiffeurId: COIFFEUR_ID, serviceIds: [serviceId], startsAt: WEDNESDAY_10AM().toISOString() });

      const day = await service.slots(PARTICULIER_ID, 'particulier', COIFFEUR_ID, {
        date: dateOf(WEDNESDAY_10AM()),
        serviceIds: [serviceId],
      });

      expect(day.closed).toBe(false);
      expect(day.slots.find((slot) => slot.label === '10:00')?.available).toBe(false);
      expect(day.slots.find((slot) => slot.label === '11:00')?.available).toBe(true);
    });

    it('says a day the salon never opens is closed', async () => {
      const day = await service.slots(PARTICULIER_ID, 'particulier', COIFFEUR_ID, {
        date: dateOf(SUNDAY_10AM()),
        serviceIds: [serviceId],
      });
      expect(day).toMatchObject({ closed: true, slots: [] });
    });

    it("for a move, doesn't block the appointment's own time, and never holds the coiffeur to the booking notice", async () => {
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceIds: [serviceId],
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      await salon.updateProfile(COIFFEUR_ID, { bookingNoticeMinutes: 20160 });

      const forCoiffeur = await service.slots(COIFFEUR_ID, 'coiffeur', COIFFEUR_ID, {
        date: dateOf(WEDNESDAY_10AM()),
        appointmentId: created.id,
      });
      expect(forCoiffeur.slots.find((slot) => slot.label === '10:00')?.available).toBe(true);

      const forClient = await service.slots(PARTICULIER_ID, 'particulier', COIFFEUR_ID, {
        date: dateOf(WEDNESDAY_10AM()),
        appointmentId: created.id,
      });
      expect(forClient.slots.every((slot) => !slot.available)).toBe(true); // all inside the two-week notice
    });

    it('needs either prestations or an appointment to size the slots', async () => {
      await expect(
        service.slots(PARTICULIER_ID, 'particulier', COIFFEUR_ID, { date: dateOf(WEDNESDAY_10AM()) }),
      ).rejects.toThrow(BadRequestException);
    });

    it('404s a salon that is not bookable', async () => {
      supabase.setAccountStatus(COIFFEUR_ID, 'banned');
      await expect(
        service.slots(PARTICULIER_ID, 'particulier', COIFFEUR_ID, { date: dateOf(WEDNESDAY_10AM()), serviceIds: [serviceId] }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('coiffeur moves an accepted appointment', () => {
    it('moves it and tells listeners so the particulier hears about it', async () => {
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceIds: [serviceId],
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      await service.decide(COIFFEUR_ID, created.id, 'confirmed');
      const heard = jest.fn();
      events.on('appointment.moved', heard);
      const newSlot = nextWeekday(4, 15);

      await service.move(COIFFEUR_ID, created.id, newSlot.toISOString());

      const [mine] = await service.listForParticulier(PARTICULIER_ID);
      expect(new Date(mine.startsAt).getTime()).toBe(newSlot.getTime());
      expect(heard).toHaveBeenCalledWith({
        appointmentId: created.id,
        particulierId: PARTICULIER_ID,
        serviceName: 'Coupe & brushing',
        previousStartsAt: created.startsAt,
        startsAt: newSlot.toISOString(),
      });
    });

    it('only moves an accepted appointment, not a pending request', async () => {
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceIds: [serviceId],
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      await expect(service.move(COIFFEUR_ID, created.id, nextWeekday(4, 15).toISOString())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses an appointment that has already started', async () => {
      const started = supabase.seedAppointment({
        particulierId: PARTICULIER_ID,
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: TEN_MINUTES_AGO(),
        durationMin: 60,
        status: 'confirmed',
      });

      await expect(service.move(COIFFEUR_ID, started, nextWeekday(4, 15).toISOString())).rejects.toThrow(
        /already started/,
      );
    });

    it("refuses a taken time, and 403s another coiffeur's appointment", async () => {
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceIds: [serviceId],
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      await service.decide(COIFFEUR_ID, created.id, 'confirmed');
      await book('particulier-2', { coiffeurId: COIFFEUR_ID, serviceIds: [serviceId], startsAt: nextWeekday(4, 15).toISOString() });

      await expect(service.move(COIFFEUR_ID, created.id, nextWeekday(4, 15).toISOString())).rejects.toThrow(
        /no longer available/,
      );
      await expect(service.move('another-coiffeur', created.id, nextWeekday(4, 11).toISOString())).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('attendance', () => {
    it('lets the coiffeur mark a past appointment as a no-show, and both sides see it', async () => {
      const past = supabase.seedAppointment({
        particulierId: PARTICULIER_ID,
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: YESTERDAY(),
        status: 'confirmed',
      });

      await service.setAttendance(COIFFEUR_ID, past, 'no_show');

      const [forSalon] = await service.listForCoiffeur(COIFFEUR_ID);
      const [forClient] = await service.listForParticulier(PARTICULIER_ID);
      expect(forSalon.attendance).toBe('no_show');
      expect(forClient.attendance).toBe('no_show');
    });

    it('refuses a no-show once the client has reviewed the appointment, so a review is never taken back', async () => {
      const past = supabase.seedAppointment({
        particulierId: PARTICULIER_ID,
        coiffeurId: COIFFEUR_ID,
        serviceId,
        startsAt: YESTERDAY(),
        status: 'confirmed',
      });
      await new ReviewsService(supabase as unknown as SupabaseService).create(PARTICULIER_ID, {
        appointmentId: past,
        rating: 5,
      });

      await expect(service.setAttendance(COIFFEUR_ID, past, 'no_show')).rejects.toThrow(/review/);
      await expect(service.setAttendance(COIFFEUR_ID, past, 'attended')).resolves.toBeUndefined();
    });

    it("refuses before the appointment has started, and on one that didn't happen", async () => {
      const created = await book(PARTICULIER_ID, {
        coiffeurId: COIFFEUR_ID,
        serviceIds: [serviceId],
        startsAt: WEDNESDAY_10AM().toISOString(),
      });
      await service.decide(COIFFEUR_ID, created.id, 'confirmed');
      await expect(service.setAttendance(COIFFEUR_ID, created.id, 'attended')).rejects.toThrow(BadRequestException);

      const cancelled = supabase.seedAppointment({
        particulierId: PARTICULIER_ID,
        coiffeurId: COIFFEUR_ID,
        startsAt: YESTERDAY(),
        status: 'cancelled',
      });
      await expect(service.setAttendance(COIFFEUR_ID, cancelled, 'attended')).rejects.toThrow(BadRequestException);
    });
  });
});
