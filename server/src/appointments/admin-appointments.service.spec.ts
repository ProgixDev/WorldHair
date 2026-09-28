import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type Stripe from 'stripe';
import { CoiffeurApplicationsService } from '../coiffeur/coiffeur-applications.service';
import { parisTime } from '../common/utils/paris-time';
import { EnvironmentVariables } from '../config/env.validation';
import { SupabaseService } from '../database/supabase.service';
import { PaymentsService } from '../payments/payments.service';
import { PayoutAccountsService } from '../payments/payout-accounts.service';
import { SalonService } from '../salon/salon.service';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { StripeService } from '../stripe/stripe.service';
import { FakeStripe } from '../../test/utils/fakes/fake-stripe';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { AdminAppointmentsService } from './admin-appointments.service';
import { AppointmentsService } from './appointments.service';

const STUDIO = 'coiffeur-1';
const MAISON = 'coiffeur-2';
const CAMILLE = 'client-1';
const AWA = 'client-2';
// A Wednesday, 10:15 in Paris.
const NOW = parisTime(2026, 9, 30, 10, 15);
const at = (day: number, hour: number, minute = 0) => parisTime(2026, 9, day, hour, minute).toISOString();

describe('AdminAppointmentsService', () => {
  let supabase: FakeSupabaseService;
  let stripe: FakeStripe;
  let events: EventEmitter2;
  let admin: AdminAppointmentsService;
  let appointments: AppointmentsService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    stripe = new FakeStripe();
    events = new EventEmitter2();
    const config = {
      get: (key: string) => ({ STRIPE_SECRET_KEY: 'sk_test_123', WEB_APP_URL: 'https://worldhair.test' })[key],
    } as unknown as ConfigService<EnvironmentVariables, true>;
    const stripeService = new StripeService(stripe as unknown as Stripe, config);
    const payouts = new PayoutAccountsService(supabase as unknown as SupabaseService, stripeService, config);
    const payments = new PaymentsService(
      supabase as unknown as SupabaseService,
      stripeService,
      new PlatformSettingsService(supabase as unknown as SupabaseService),
      payouts,
      events,
      config,
    );
    const salon = new SalonService(supabase as unknown as SupabaseService);
    appointments = new AppointmentsService(
      supabase as unknown as SupabaseService,
      new CoiffeurApplicationsService(supabase as unknown as SupabaseService, events),
      salon,
      events,
      payments,
      payouts,
    );
    admin = new AdminAppointmentsService(supabase as unknown as SupabaseService);

    supabase.seedValidatedSalon({ profileId: STUDIO, firstName: 'Sofia', lastName: 'Benali', salonName: 'Studio Élégance', phone: '06 12 34 56 78', city: 'Paris' });
    supabase.seedValidatedSalon({ profileId: MAISON, firstName: 'Awa', lastName: 'Sy', salonName: 'Maison Tresse', city: 'Lyon' });
    supabase.addUser('camille', { id: CAMILLE, email: 'camille@example.com', email_confirmed_at: null }, 'particulier', {
      firstName: 'Camille',
      lastName: 'Durand',
    });
    supabase.addUser('awa', { id: AWA, email: 'awa@example.com', email_confirmed_at: null }, 'particulier', {
      firstName: 'Awa',
      lastName: 'Diallo',
    });
  });

  function seed(overrides: { coiffeurId?: string; particulierId?: string; startsAt?: string; status?: string; price?: number } = {}): string {
    return supabase.seedAppointment({
      particulierId: overrides.particulierId ?? CAMILLE,
      coiffeurId: overrides.coiffeurId ?? STUDIO,
      startsAt: overrides.startsAt ?? at(30, 15),
      durationMin: 60,
      status: overrides.status ?? 'confirmed',
      price: overrides.price ?? 40,
    });
  }

  const page = { limit: 20, offset: 0, now: NOW };

  describe('list', () => {
    it('lists bookings with their salon, client and payment, the latest first — never a slot held while paying', async () => {
      const early = seed({ startsAt: at(29, 10) });
      const late = seed({ startsAt: at(30, 15) });
      seed({ status: 'awaiting_payment', startsAt: at(30, 17) });
      supabase.seedPayment({ appointmentId: late, particulierId: CAMILLE, coiffeurId: STUDIO, amount: 40, refundedAmount: 10 });

      const { items, total } = await admin.list(page);

      expect(total).toBe(2);
      expect(items.map((item) => item.id)).toEqual([late, early]);
      expect(items[0]).toMatchObject({
        salon: { id: STUDIO, name: 'Studio Élégance' },
        client: { id: CAMILLE, name: 'Camille Durand' },
        payment: { status: 'succeeded', amount: 40, refundedAmount: 10 },
      });
      expect(items[1].payment).toBeNull();
    });

    it('filters by status — a confirmed booking is upcoming until it ends, then done — by salon or client words, and by dates', async () => {
      const upcoming = seed({ startsAt: at(30, 15) });
      const done = seed({ startsAt: at(29, 10) });
      const pending = seed({ status: 'pending', startsAt: at(30, 17) });
      const lyon = seed({ coiffeurId: MAISON, particulierId: AWA, status: 'cancelled', startsAt: at(28, 10) });

      const ids = async (filters: Parameters<AdminAppointmentsService['list']>[0]) =>
        (await admin.list({ ...page, ...filters })).items.map((item) => item.id);

      expect(await ids({ status: 'upcoming' })).toEqual([upcoming]);
      expect(await ids({ status: 'done' })).toEqual([done]);
      expect(await ids({ status: 'pending' })).toEqual([pending]);
      expect(await ids({ salon: 'maison' })).toEqual([lyon]);
      expect(await ids({ salon: 'elegance' })).toEqual([pending, upcoming, done]);
      expect(await ids({ client: 'DIALLO awa' })).toEqual([lyon]);
      // Paris days, both included.
      expect(await ids({ from: '2026-09-29', to: '2026-09-29' })).toEqual([done]);
      expect(await ids({ from: '2026-09-29' })).toEqual([pending, upcoming, done]);
      expect(await ids({ to: '2026-09-28' })).toEqual([lyon]);
    });

    it('reads days on a Paris calendar: a booking at 00:30 belongs to its Paris day, not the UTC one', async () => {
      // 00:30 in Paris is still the day before in UTC.
      const justAfterMidnight = seed({ startsAt: at(29, 0, 30) });
      const lateEvening = seed({ startsAt: at(29, 23, 30) });
      const nextDay = seed({ startsAt: at(30, 0, 30) });

      const ids = async (from: string, to: string) =>
        (await admin.list({ ...page, from, to })).items.map((item) => item.id);

      expect(await ids('2026-09-29', '2026-09-29')).toEqual([lateEvening, justAfterMidnight]);
      expect(await ids('2026-09-30', '2026-09-30')).toEqual([nextDay]);
    });

    it('pages, with the total of every match — also on a page past the end', async () => {
      for (const day of [25, 26, 27, 28, 29]) seed({ startsAt: at(day, 10) });

      const first = await admin.list({ ...page, limit: 2 });
      const last = await admin.list({ ...page, limit: 2, offset: 4 });
      const pastTheEnd = await admin.list({ ...page, limit: 2, offset: 10 });

      expect(first).toMatchObject({ total: 5 });
      expect(first.items).toHaveLength(2);
      expect(last).toMatchObject({ total: 5 });
      expect(last.items).toHaveLength(1);
      expect(pastTheEnd).toEqual({ items: [], total: 5 });
    });
  });

  describe('detail', () => {
    it('shows one booking in full: its prestations, the client to reach, the salon, the payment', async () => {
      const id = seed({ startsAt: at(29, 10) });
      supabase.seedPayment({ appointmentId: id, particulierId: CAMILLE, coiffeurId: STUDIO, amount: 40, paymentIntentId: 'pi_1' });

      await expect(admin.detail(id, NOW)).resolves.toMatchObject({
        id,
        status: 'done',
        services: [{ name: 'Coupe', price: 40 }],
        client: { id: CAMILLE, name: 'Camille Durand', email: 'camille@example.com' },
        salon: { id: STUDIO, name: 'Studio Élégance', phone: '06 12 34 56 78', city: 'Paris' },
        payment: { amount: 40, paymentIntentId: 'pi_1' },
      });
      await expect(admin.detail('no-such-booking', NOW)).rejects.toThrow(NotFoundException);
    });

    it('keeps a booking whose client, or salon, deleted their account — without them', async () => {
      const id = seed({ startsAt: at(29, 10) });
      supabase.seedPayment({ appointmentId: id, particulierId: CAMILLE, coiffeurId: STUDIO, amount: 40 });
      await supabase.client.auth.admin.deleteUser(CAMILLE);

      await expect(admin.list(page)).resolves.toMatchObject({ items: [{ id, client: { id: null, name: 'Client supprimé' } }] });
      await expect(admin.detail(id, NOW)).resolves.toMatchObject({
        client: { id: null, name: 'Client supprimé', email: null },
        payment: { amount: 40 },
      });

      supabase.seedValidatedSalon({ profileId: 'coiffeur-3', firstName: 'Léa', lastName: 'Martin', salonName: 'Atelier Léa' });
      const other = seed({ coiffeurId: 'coiffeur-3', particulierId: AWA, startsAt: at(28, 10) });
      await supabase.client.auth.admin.deleteUser('coiffeur-3');
      await expect(admin.detail(other, NOW)).resolves.toMatchObject({ salon: { id: null, name: 'Salon supprimé', email: null } });
    });

    it("doesn't show a slot held while its client pays: it isn't a booking yet", async () => {
      const held = seed({ status: 'awaiting_payment' });

      await expect(admin.detail(held, NOW)).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel (appointments.cancelByAdmin)', () => {
    it('cancels with the reason, refunds all that is left, and tells both sides why', async () => {
      const id = seed({ status: 'pending', startsAt: at(30, 15) });
      supabase.seedPayment({ appointmentId: id, particulierId: CAMILLE, coiffeurId: STUDIO, amount: 40, refundedAmount: 5, paymentIntentId: 'pi_1' });
      const heard = jest.fn();
      events.on('appointment.cancelled_by_admin', heard);

      await expect(appointments.cancelByAdmin(id, '  Salon fermé ce jour-là.  ')).resolves.toEqual({ refunded: 35, refundFailed: false });

      expect(stripe.refundsCreated[0].params).toMatchObject({ payment_intent: 'pi_1', amount: 3500 });
      await expect(admin.detail(id, NOW)).resolves.toMatchObject({
        status: 'cancelled',
        cancelledBy: 'admin',
        cancellationReason: 'Salon fermé ce jour-là.',
      });
      expect(heard).toHaveBeenCalledWith(
        expect.objectContaining({ appointmentId: id, particulierId: CAMILLE, coiffeurId: STUDIO, reason: 'Salon fermé ce jour-là.' }),
      );
      // Both apps show it too, should the push never arrive.
      const cancelled = { cancelledBy: 'admin', cancellationReason: 'Salon fermé ce jour-là.' };
      expect((await appointments.listForParticulier(CAMILLE)).find((item) => item.id === id)).toMatchObject(cancelled);
      expect((await appointments.listForCoiffeur(STUDIO)).find((item) => item.id === id)).toMatchObject(cancelled);
    });

    it('works after the salon was paid too: its share comes back first', async () => {
      const id = seed({ startsAt: at(20, 10) });
      supabase.seedPayment({ appointmentId: id, particulierId: CAMILLE, coiffeurId: STUDIO, amount: 40, transferId: 'tr_1', transferAmount: 36 });
      stripe.putTransfer({ id: 'tr_1', amount: 3600, transferGroup: id });

      await expect(appointments.cancelByAdmin(id, 'Le client a été refusé à la porte.')).resolves.toEqual({ refunded: 40, refundFailed: false });

      expect(stripe.reversalsCreated).toEqual([{ transferId: 'tr_1', params: { amount: 3600 } }]);
    });

    it('refunds in full a booking whose payout Stripe refused: now cancelled, it will never be paid out', async () => {
      const id = seed({ startsAt: at(20, 10) });
      supabase.seedPayment({ appointmentId: id, particulierId: CAMILLE, coiffeurId: STUDIO, amount: 40, transferAttemptedAt: at(21, 11) });

      await expect(appointments.cancelByAdmin(id, 'Litige')).resolves.toEqual({ refunded: 40, refundFailed: false });

      expect(stripe.reversalsCreated).toEqual([]);
      expect(supabase.paymentFor(id)).toMatchObject({ refunded_amount: 40, transfer_id: null, transfer_attempted_at: null });
    });

    it('still cancels when Stripe cannot refund right now, and says so', async () => {
      const id = seed({ startsAt: at(30, 15) });
      supabase.seedPayment({ appointmentId: id, particulierId: CAMILLE, coiffeurId: STUDIO, amount: 40 });
      stripe.failNextRefund();

      await expect(appointments.cancelByAdmin(id, 'Litige')).resolves.toEqual({ refunded: 0, refundFailed: true });
      await expect(admin.detail(id, NOW)).resolves.toMatchObject({ status: 'cancelled' });
    });

    it('refuses a booking already cancelled or refused', async () => {
      for (const status of ['cancelled', 'refused']) {
        await expect(appointments.cancelByAdmin(seed({ status }), 'Litige')).rejects.toThrow(BadRequestException);
      }
    });
  });
});
