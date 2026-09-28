import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type Stripe from 'stripe';
import { CoiffeurApplicationsService } from '../coiffeur/coiffeur-applications.service';
import { EnvironmentVariables } from '../config/env.validation';
import { SupabaseService } from '../database/supabase.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../notifications/push.service';
import { PushTokensService } from '../notifications/push-tokens.service';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { StripeService } from '../stripe/stripe.service';
import { FakeStripe } from '../../test/utils/fakes/fake-stripe';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { SubscriptionsService } from './subscriptions.service';

const COIFFEUR_ID = 'coiffeur-1';
const DAY_SECONDS = 86_400;
const nowSeconds = () => Math.floor(Date.now() / 1000);
const isoFromSeconds = (seconds: number) => new Date(seconds * 1000).toISOString();

function testConfig(): ConfigService<EnvironmentVariables, true> {
  const values: Record<string, unknown> = {
    MAIL_TRANSPORT: 'json',
    MAIL_HOST: '',
    MAIL_PORT: 587,
    MAIL_SECURE: false,
    MAIL_USER: '',
    MAIL_PASSWORD: '',
    MAIL_FROM: 'WorldHair <no-reply@worldhair.app>',
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    WEB_APP_URL: 'https://worldhair.test/',
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService<EnvironmentVariables, true>;
}

/** Never calls real Expo infra. */
class FakePushService {
  send: PushService['send'] = async (messages) => messages.map((m) => ({ token: m.token, ok: true }));
}

function stripeEvent(type: string, object: unknown): Stripe.Event {
  return { id: `evt_${type}`, type, data: { object } } as unknown as Stripe.Event;
}

describe('SubscriptionsService', () => {
  let supabase: FakeSupabaseService;
  let stripe: FakeStripe;
  let mail: MailService;
  let service: SubscriptionsService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    supabase.addUser('coiffeur-token', { id: COIFFEUR_ID, email: 'sofia@example.com', email_confirmed_at: null }, 'coiffeur', {
      firstName: 'Sofia',
      lastName: 'Benali',
    });
    // Validated by the admin: the only coiffeurs who may subscribe.
    supabase.seedApplication({ profileId: COIFFEUR_ID, status: 'validated', shopProfileComplete: true });
    stripe = new FakeStripe();
    const config = testConfig();
    const pushTokens = new PushTokensService(supabase as unknown as SupabaseService);
    const notifications = new NotificationsService(
      supabase as unknown as SupabaseService,
      pushTokens,
      new FakePushService() as unknown as PushService,
    );
    mail = new MailService(config);
    service = new SubscriptionsService(
      supabase as unknown as SupabaseService,
      new CoiffeurApplicationsService(supabase as unknown as SupabaseService, new EventEmitter2()),
      new StripeService(stripe as unknown as Stripe, config),
      new PlatformSettingsService(supabase as unknown as SupabaseService),
      notifications,
      mail,
      config,
    );
  });

  describe('getMine', () => {
    it('reads as not subscribed yet, with the trial a first Checkout would get', async () => {
      await expect(service.getMine(COIFFEUR_ID)).resolves.toMatchObject({
        state: 'none',
        listed: false,
        canSubscribe: true,
        canManage: false,
        trialDays: 30,
      });
    });

    it('offers nothing to subscribe to before the admin validates the application', async () => {
      supabase.seedApplication({ profileId: COIFFEUR_ID, status: 'pending' });

      await expect(service.getMine(COIFFEUR_ID)).resolves.toMatchObject({
        state: 'none',
        awaitingValidation: true,
        canSubscribe: false,
      });
    });

    it("follows the row Stripe's webhooks keep, and offers no second trial", async () => {
      supabase.seedSubscription({
        profileId: COIFFEUR_ID,
        status: 'trialing',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        trialEndsAt: '2030-01-01T00:00:00.000Z',
        currentPeriodEnd: '2030-01-01T00:00:00.000Z',
      });

      await expect(service.getMine(COIFFEUR_ID)).resolves.toMatchObject({
        state: 'trialing',
        listed: true,
        canSubscribe: false,
        canManage: true,
        trialDays: 0,
        trialEndsAt: '2030-01-01T00:00:00.000Z',
      });
    });
  });

  describe('listPrices', () => {
    it("reads both plans' prices from Stripe, in euros", async () => {
      await expect(service.listPrices()).resolves.toEqual([
        { plan: 'monthly', amount: 19, currency: 'eur' },
        { plan: 'yearly', amount: 182, currency: 'eur' },
      ]);
    });

    it('503s until the setup script has created them', async () => {
      stripe.prices_ = [];
      await expect(service.listPrices()).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('createCheckoutSession', () => {
    it("creates the coiffeur's Stripe customer once, then a subscription Checkout with the admin's trial", async () => {
      supabase.seedPlatformSettings({ trialDays: 14 });

      const { url } = await service.createCheckoutSession(COIFFEUR_ID, 'yearly');
      await service.createCheckoutSession(COIFFEUR_ID, 'monthly');

      expect(url).toBe('https://checkout.stripe.test/cs_test_1');
      expect(stripe.customersCreated).toHaveLength(1);
      expect(stripe.customersCreated[0]).toMatchObject({ email: 'sofia@example.com', metadata: { profile_id: COIFFEUR_ID } });
      expect(stripe.checkoutSessionsCreated[0]).toMatchObject({
        mode: 'subscription',
        customer: 'cus_test_1',
        client_reference_id: COIFFEUR_ID,
        line_items: [{ price: 'price_yearly', quantity: 1 }],
        subscription_data: { trial_period_days: 14, metadata: { profile_id: COIFFEUR_ID } },
        success_url: 'https://worldhair.test/pro/abonnement?checkout=success',
        cancel_url: 'https://worldhair.test/pro/abonnement?checkout=cancel',
      });
      expect(supabase.subscriptionFor(COIFFEUR_ID)).toMatchObject({ status: 'none', stripe_customer_id: 'cus_test_1' });
    });

    it("refuses a coiffeur whose application isn't validated: they'd pay without ever being listed", async () => {
      supabase.seedApplication({ profileId: COIFFEUR_ID, status: 'pending' });

      await expect(service.createCheckoutSession(COIFFEUR_ID, 'monthly')).rejects.toThrow(ForbiddenException);
      expect(stripe.customersCreated).toHaveLength(0);
    });

    it('offers no trial to a coiffeur who already had a subscription', async () => {
      supabase.seedSubscription({
        profileId: COIFFEUR_ID,
        status: 'canceled',
        stripeCustomerId: 'cus_9',
        stripeSubscriptionId: 'sub_old',
      });

      await service.createCheckoutSession(COIFFEUR_ID, 'monthly');

      expect(stripe.customersCreated).toHaveLength(0);
      expect(stripe.checkoutSessionsCreated[0].customer).toBe('cus_9');
      expect(stripe.checkoutSessionsCreated[0].subscription_data?.trial_period_days).toBeUndefined();
    });

    it("refuses while a Stripe subscription is live: that's the portal's job", async () => {
      supabase.seedSubscription({
        profileId: COIFFEUR_ID,
        status: 'active',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
      });

      await expect(service.createCheckoutSession(COIFFEUR_ID, 'monthly')).rejects.toThrow(BadRequestException);
    });

    it('lets a salon with an offered subscription subscribe for real', async () => {
      supabase.seedSubscription({ profileId: COIFFEUR_ID, status: 'active', currentPeriodEnd: '2030-01-01T00:00:00.000Z' });

      await expect(service.createCheckoutSession(COIFFEUR_ID, 'monthly')).resolves.toEqual({
        url: 'https://checkout.stripe.test/cs_test_1',
      });
    });
  });

  describe('createPortalSession', () => {
    it("opens Stripe's portal for the coiffeur, with WorldHair's own portal settings, back to the website", async () => {
      supabase.seedSubscription({ profileId: COIFFEUR_ID, status: 'active', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' });
      stripe.portalConfigurations = [
        { id: 'bpc_other', metadata: {} },
        { id: 'bpc_worldhair', metadata: { app: 'worldhair' } },
      ];

      await expect(service.createPortalSession(COIFFEUR_ID)).resolves.toEqual({ url: 'https://billing.stripe.test/session' });
      expect(stripe.portalSessionsCreated[0]).toEqual({
        customer: 'cus_1',
        return_url: 'https://worldhair.test/pro/abonnement',
        configuration: 'bpc_worldhair',
      });
    });

    it('refuses before any subscription', async () => {
      await expect(service.createPortalSession(COIFFEUR_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe('Stripe events', () => {
    it('records the subscription once Checkout completes', async () => {
      const trialEnd = nowSeconds() + 30 * DAY_SECONDS;
      stripe.putSubscription({
        id: 'sub_1',
        customer: 'cus_1',
        status: 'trialing',
        profileId: COIFFEUR_ID,
        plan: 'yearly',
        trialEnd,
        currentPeriodEnd: trialEnd,
      });

      await service.handleStripeEvent(
        stripeEvent('checkout.session.completed', { mode: 'subscription', subscription: 'sub_1', client_reference_id: COIFFEUR_ID }),
      );

      await expect(service.getMine(COIFFEUR_ID)).resolves.toMatchObject({
        state: 'trialing',
        plan: 'yearly',
        listed: true,
        canManage: true,
        trialEndsAt: isoFromSeconds(trialEnd),
      });
    });

    it('reads a cancellation scheduled in the portal as ending on that date', async () => {
      const periodEnd = nowSeconds() + 20 * DAY_SECONDS;
      stripe.putSubscription({
        id: 'sub_1',
        customer: 'cus_1',
        status: 'active',
        profileId: COIFFEUR_ID,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: true,
      });

      await service.handleStripeEvent(stripeEvent('customer.subscription.updated', { id: 'sub_1' }));

      await expect(service.getMine(COIFFEUR_ID)).resolves.toMatchObject({
        state: 'ending',
        listed: true,
        endsAt: isoFromSeconds(periodEnd),
      });
    });

    it('hides the salon once the subscription ends, and tells the coiffeur once, by push and email', async () => {
      const sendEnded = jest.spyOn(mail, 'sendSubscriptionEndedEmail');
      supabase.seedSubscription({ profileId: COIFFEUR_ID, status: 'active', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' });
      stripe.putSubscription({ id: 'sub_1', customer: 'cus_1', status: 'canceled', profileId: COIFFEUR_ID });

      await service.handleStripeEvent(stripeEvent('customer.subscription.deleted', { id: 'sub_1' }));
      await service.handleStripeEvent(stripeEvent('customer.subscription.deleted', { id: 'sub_1' }));

      await expect(service.getMine(COIFFEUR_ID)).resolves.toMatchObject({ state: 'expired', listed: false, canSubscribe: true });
      expect(supabase.notifyLogFor(COIFFEUR_ID).filter((n) => n.type === 'subscription_ended')).toHaveLength(1);
      expect(sendEnded).toHaveBeenCalledTimes(1);
      expect(sendEnded).toHaveBeenCalledWith('sofia@example.com');
    });

    it('keeps the salon listed while Stripe retries a failed payment, and warns the coiffeur', async () => {
      supabase.seedSubscription({ profileId: COIFFEUR_ID, status: 'active', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' });
      stripe.putSubscription({ id: 'sub_1', customer: 'cus_1', status: 'past_due', profileId: COIFFEUR_ID });

      await service.handleStripeEvent(
        stripeEvent('invoice.payment_failed', {
          id: 'in_1',
          attempt_count: 1,
          parent: { subscription_details: { subscription: 'sub_1' } },
        }),
      );

      await expect(service.getMine(COIFFEUR_ID)).resolves.toMatchObject({ state: 'past_due', listed: true });
      expect(supabase.notifyLogFor(COIFFEUR_ID).map((n) => n.type)).toEqual(['subscription_payment_failed']);
    });

    it('never lets an abandoned attempt overwrite the live subscription', async () => {
      supabase.seedSubscription({ profileId: COIFFEUR_ID, status: 'active', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_live' });
      stripe.putSubscription({ id: 'sub_old', customer: 'cus_1', status: 'incomplete_expired', profileId: COIFFEUR_ID });

      await service.handleStripeEvent(stripeEvent('customer.subscription.updated', { id: 'sub_old' }));

      expect(supabase.subscriptionFor(COIFFEUR_ID)).toMatchObject({ status: 'active', stripe_subscription_id: 'sub_live' });
    });

    it("finds the coiffeur from the Stripe customer when the subscription doesn't say", async () => {
      supabase.seedSubscription({ profileId: COIFFEUR_ID, status: 'none', stripeCustomerId: 'cus_7' });
      stripe.putSubscription({ id: 'sub_7', customer: 'cus_7', status: 'active', currentPeriodEnd: nowSeconds() + DAY_SECONDS });

      await service.handleStripeEvent(stripeEvent('customer.subscription.created', { id: 'sub_7' }));

      expect(supabase.subscriptionFor(COIFFEUR_ID)).toMatchObject({ status: 'active', stripe_subscription_id: 'sub_7' });
    });

    it("ignores a subscription it can't match to any coiffeur, and event types it doesn't use", async () => {
      stripe.putSubscription({ id: 'sub_x', customer: 'cus_unknown', status: 'active' });

      await service.handleStripeEvent(stripeEvent('customer.subscription.updated', { id: 'sub_x' }));
      await service.handleStripeEvent(stripeEvent('charge.refunded', { id: 'ch_1' }));

      expect(supabase.subscriptionFor(COIFFEUR_ID)).toBeUndefined();
    });
  });

  describe('listAllForAdmin', () => {
    it("shows every coiffeur's state, with a link to the customer in Stripe's test dashboard", async () => {
      supabase.seedSubscription({
        profileId: COIFFEUR_ID,
        status: 'active',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        currentPeriodEnd: '2030-01-01T00:00:00.000Z',
      });

      const [summary] = await service.listAllForAdmin();

      expect(summary).toMatchObject({
        profileId: COIFFEUR_ID,
        email: 'sofia@example.com',
        state: 'active',
        stripeStatus: 'active',
        currentPeriodEnd: '2030-01-01T00:00:00.000Z',
        stripeCustomerUrl: 'https://dashboard.stripe.com/test/customers/cus_1',
      });
    });
  });
});
