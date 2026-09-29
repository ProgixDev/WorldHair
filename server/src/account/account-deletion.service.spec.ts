import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type Stripe from 'stripe';
import { AppointmentsService } from '../appointments/appointments.service';
import { CoiffeurApplicationsService } from '../coiffeur/coiffeur-applications.service';
import { EnvironmentVariables } from '../config/env.validation';
import { SupabaseService } from '../database/supabase.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../notifications/push.service';
import { PushTokensService } from '../notifications/push-tokens.service';
import { PaymentsService } from '../payments/payments.service';
import { PayoutAccountsService } from '../payments/payout-accounts.service';
import { SalonService } from '../salon/salon.service';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { StripeService } from '../stripe/stripe.service';
import { SubscriptionNotifier } from '../subscriptions/subscription-notifier';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { FakeStripe } from '../../test/utils/fakes/fake-stripe';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { AccountDeletionService } from './account-deletion.service';

const STUDIO = 'coiffeur-1';
const CAMILLE = 'client-1';
const HOUR_MS = 3_600_000;
const fromNow = (hours: number) => new Date(Date.now() + hours * HOUR_MS).toISOString();

function testConfig(): ConfigService<EnvironmentVariables, true> {
  const values: Record<string, unknown> = {
    MAIL_TRANSPORT: 'json',
    MAIL_FROM: 'WorldHair <no-reply@worldhair.app>',
    STRIPE_SECRET_KEY: 'sk_test_123',
    WEB_APP_URL: 'https://worldhair.test',
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService<EnvironmentVariables, true>;
}

class FakePushService {
  send: PushService['send'] = async (messages) => messages.map((m) => ({ token: m.token, ok: true }));
}

describe('AccountDeletionService', () => {
  let supabase: FakeSupabaseService;
  let stripe: FakeStripe;
  let events: EventEmitter2;
  let deletion: AccountDeletionService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    stripe = new FakeStripe();
    events = new EventEmitter2();
    const config = testConfig();
    const stripeService = new StripeService(stripe as unknown as Stripe, config);
    const settings = new PlatformSettingsService(supabase as unknown as SupabaseService);
    const payouts = new PayoutAccountsService(supabase as unknown as SupabaseService, stripeService, config);
    const payments = new PaymentsService(supabase as unknown as SupabaseService, stripeService, settings, payouts, events, config);
    const applications = new CoiffeurApplicationsService(supabase as unknown as SupabaseService, events);
    const appointments = new AppointmentsService(
      supabase as unknown as SupabaseService,
      applications,
      new SalonService(supabase as unknown as SupabaseService),
      events,
      payments,
      payouts,
    );
    const notifications = new NotificationsService(
      supabase as unknown as SupabaseService,
      new PushTokensService(supabase as unknown as SupabaseService),
      new FakePushService() as unknown as PushService,
    );
    const subscriptions = new SubscriptionsService(
      supabase as unknown as SupabaseService,
      applications,
      stripeService,
      settings,
      new SubscriptionNotifier(supabase as unknown as SupabaseService, notifications, new MailService(config)),
      config,
    );
    deletion = new AccountDeletionService(supabase as unknown as SupabaseService, appointments, payments, subscriptions);

    supabase.seedValidatedSalon({ profileId: STUDIO, firstName: 'Sofia', lastName: 'Benali', salonName: 'Studio W' });
    supabase.addUser('camille-token', { id: CAMILLE, email: 'camille@example.com', email_confirmed_at: null }, 'particulier', {
      firstName: 'Camille',
      lastName: 'Durand',
    });
  });

  /** A booking paid 40 € in the app. */
  function paidBooking(startsAt: string, status = 'confirmed'): string {
    const id = supabase.seedAppointment({ particulierId: CAMILLE, coiffeurId: STUDIO, startsAt, status, durationMin: 60, price: 40 });
    supabase.seedPayment({ appointmentId: id, particulierId: CAMILLE, coiffeurId: STUDIO, amount: 40 });
    return id;
  }

  describe('a client', () => {
    it("keeps a booking past the salon's cancellation deadline — owed to the salon, as if the client had stayed — and forgets the client's notes", async () => {
      // Studio W asks for a day's notice: in two hours is too late to cancel.
      const tooLate = paidBooking(fromNow(2));
      const past = supabase.seedAppointment({
        particulierId: CAMILLE,
        coiffeurId: STUDIO,
        startsAt: fromNow(-24 * 30),
        status: 'confirmed',
        note: 'Appelez-moi au 06 00 00 00 00',
      });

      await deletion.delete(CAMILLE, 'particulier');

      expect(supabase.appointmentFor(tooLate)).toMatchObject({ status: 'confirmed', particulier_id: null });
      expect(stripe.refundsCreated).toEqual([]);
      expect(supabase.appointmentFor(past)).toMatchObject({ particulier_id: null, client_note: null });
    });

    it('cancels and refunds every booking still to come, tells the salon, and keeps the past ones without the client', async () => {
      const upcoming = paidBooking(fromNow(48));
      const request = paidBooking(fromNow(72), 'pending');
      const past = paidBooking(fromNow(-24 * 30));
      const held = supabase.seedAppointment({ particulierId: CAMILLE, coiffeurId: STUDIO, startsAt: fromNow(96), status: 'awaiting_payment' });
      supabase.seedFavorite(CAMILLE, STUDIO);
      supabase.seedStorageObject('user-photos', `${CAMILLE}/avatar.jpg`);
      supabase.seedStorageObject('user-photos', `${STUDIO}/salon-cover.jpg`);
      const heard = jest.fn();
      events.on('appointment.cancelled', heard);

      await deletion.delete(CAMILLE, 'particulier');

      expect(stripe.refundsCreated.map((refund) => refund.params.amount)).toEqual([4000, 4000]);
      for (const id of [upcoming, request]) {
        expect(supabase.appointmentFor(id)).toMatchObject({ status: 'cancelled', cancelled_by: 'client', particulier_id: null });
        expect(heard).toHaveBeenCalledWith(expect.objectContaining({ appointmentId: id, coiffeurId: STUDIO, cancelledByUserId: CAMILLE }));
      }
      // Kept for the salon's history and WorldHair's accounts — without the client.
      expect(supabase.appointmentFor(past)).toMatchObject({ status: 'confirmed', particulier_id: null, coiffeur_id: STUDIO });
      expect(supabase.paymentFor(past)).toMatchObject({ particulier_id: null, amount: 40, refunded_amount: 0 });
      expect(supabase.appointmentFor(held)).toBeUndefined();
      expect(supabase.favoritesOf(CAMILLE)).toEqual([]);
      expect(supabase.storagePaths('user-photos')).toEqual([`${STUDIO}/salon-cover.jpg`]);
      expect(supabase.profileFor(CAMILLE)).toBeUndefined();
      await expect(supabase.client.auth.getUser('camille-token')).resolves.toMatchObject({ data: { user: null } });
    });
  });

  describe('a salon', () => {
    it("cancels and refunds its bookings still to come (clients told), pays it what it's owed now, ends its subscription, removes its files", async () => {
      const upcoming = paidBooking(fromNow(48));
      // Over two hours ago: normally paid out tomorrow — the salon is paid now instead.
      const lastOne = paidBooking(fromNow(-3));
      supabase.seedSubscription({ profileId: STUDIO, status: 'active', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' });
      for (const path of [`${STUDIO}/identity.pdf`, `${STUDIO}/kbis.pdf`]) supabase.seedStorageObject('coiffeur-documents', path);
      for (const path of [`${STUDIO}/salon-cover.jpg`, `${STUDIO}/gallery/a.jpg`, `${STUDIO}/gallery/b.jpg`, `${CAMILLE}/avatar.jpg`]) {
        supabase.seedStorageObject('user-photos', path);
      }
      const heard = jest.fn();
      events.on('appointment.cancelled', heard);

      await deletion.delete(STUDIO, 'coiffeur');

      expect(supabase.appointmentFor(upcoming)).toMatchObject({ status: 'cancelled', cancelled_by: 'salon', coiffeur_id: null });
      expect(stripe.refundsCreated.map((refund) => refund.params.amount)).toEqual([4000]);
      expect(heard).toHaveBeenCalledWith(expect.objectContaining({ appointmentId: upcoming, particulierId: CAMILLE, cancelledByUserId: STUDIO }));
      expect(stripe.transfersCreated.map((transfer) => transfer.params)).toEqual([
        expect.objectContaining({ amount: 3600, destination: `acct_${STUDIO}`, transfer_group: lastOne }),
      ]);
      expect(stripe.customersDeleted).toEqual(['cus_1']);
      expect(supabase.storagePaths('coiffeur-documents')).toEqual([]);
      expect(supabase.storagePaths('user-photos')).toEqual([`${CAMILLE}/avatar.jpg`]);
      // The client's history keeps the booking, without the salon.
      expect(supabase.appointmentFor(lastOne)).toMatchObject({ status: 'confirmed', coiffeur_id: null, particulier_id: CAMILLE });
      expect(supabase.profileFor(STUDIO)).toBeUndefined();
    });

    it("deletes nothing while its pay can't be sent — and goes through once it can", async () => {
      const upcoming = paidBooking(fromNow(48));
      paidBooking(fromNow(-3));
      stripe.failNextTransfer();

      await expect(deletion.delete(STUDIO, 'coiffeur')).rejects.toThrow(ServiceUnavailableException);

      expect(supabase.profileFor(STUDIO)).toBeDefined();
      expect(supabase.appointmentFor(upcoming)).toMatchObject({ status: 'confirmed' });
      expect(stripe.refundsCreated).toEqual([]);

      await deletion.delete(STUDIO, 'coiffeur');
      expect(supabase.profileFor(STUDIO)).toBeUndefined();
      expect(stripe.transfersCreated).toHaveLength(1);
    });

    it("refuses to go while it's owed money it has nowhere to receive: its payouts must be set up first", async () => {
      supabase.seedPayoutAccount({ profileId: STUDIO, stripeAccountId: `acct_${STUDIO}`, payoutsEnabled: false });
      const upcoming = paidBooking(fromNow(48));
      paidBooking(fromNow(-3));

      await expect(deletion.delete(STUDIO, 'coiffeur')).rejects.toThrow(ConflictException);

      expect(supabase.profileFor(STUDIO)).toBeDefined();
      expect(supabase.appointmentFor(upcoming)).toMatchObject({ status: 'confirmed' });
      expect(stripe.transfersCreated).toEqual([]);
    });

    it("lets the demo salon go: its money stays with WorldHair by design", async () => {
      supabase.seedPayoutAccount({ profileId: STUDIO, stripeAccountId: null, payoutsEnabled: false, bookableWithoutPayouts: true });
      paidBooking(fromNow(-3));

      await deletion.delete(STUDIO, 'coiffeur');

      expect(supabase.profileFor(STUDIO)).toBeUndefined();
      expect(stripe.transfersCreated).toEqual([]);
    });

    it('ends its subscription last: a failure before that leaves it running, to try again', async () => {
      supabase.seedSubscription({ profileId: STUDIO, status: 'active', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' });
      supabase.seedStorageObject('coiffeur-documents', `${STUDIO}/identity.pdf`);
      supabase.failNextStorageList();

      await expect(deletion.delete(STUDIO, 'coiffeur')).rejects.toThrow(ServiceUnavailableException);

      expect(stripe.customersDeleted).toEqual([]);
      expect(supabase.profileFor(STUDIO)).toBeDefined();
    });

    it('goes through when Stripe had already forgotten its customer', async () => {
      supabase.seedSubscription({ profileId: STUDIO, status: 'canceled', stripeCustomerId: 'cus_gone', stripeSubscriptionId: 'sub_1' });
      stripe.forgetCustomer('cus_gone');

      await deletion.delete(STUDIO, 'coiffeur');

      expect(supabase.profileFor(STUDIO)).toBeUndefined();
    });
  });
});
