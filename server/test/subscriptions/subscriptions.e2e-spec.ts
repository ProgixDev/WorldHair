import { randomUUID } from 'crypto';
import request from 'supertest';
import type { Server } from 'http';
import Stripe from 'stripe';
import { createTestApp, TestApp } from '../utils/app-harness';
import { FakeStripe } from '../utils/fakes/fake-stripe';

/** Same value as test-env.ts: specs sign webhook payloads with it, the app checks them for real. */
const WEBHOOK_SECRET = 'whsec_test_secret';

/** HTTP-level wiring for subscriptions — the rules themselves are covered by SubscriptionsService's unit tests. */
describe('subscriptions (e2e)', () => {
  let harness: TestApp;
  let server: Server;
  let stripe: FakeStripe;

  const coiffeurToken = 'coiffeur-token';
  const coiffeur = { id: randomUUID(), email: 'sofia@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };
  const particulierToken = 'particulier-token';
  const particulier = { id: randomUUID(), email: 'fan@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };
  const adminToken = 'admin-token';
  const admin = { id: randomUUID(), email: 'admin@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };

  beforeAll(async () => {
    harness = await createTestApp();
    stripe = harness.stripe;
    server = harness.app.getHttpServer() as Server;
  });

  beforeEach(() => {
    harness.supabase.addUser(coiffeurToken, coiffeur, 'coiffeur');
    harness.supabase.seedApplication({ profileId: coiffeur.id, status: 'validated', shopProfileComplete: true });
    harness.supabase.addUser(particulierToken, particulier, 'particulier');
    harness.supabase.addUser(adminToken, admin, 'admin');
  });

  afterEach(() => harness.resetDb());

  afterAll(() => harness.close());

  function signedWebhook(payload: object) {
    const body = JSON.stringify(payload);
    const signature = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: WEBHOOK_SECRET });
    return request(server)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', signature)
      .send(body);
  }

  describe('coiffeur', () => {
    it('reads their subscription, the prices, and starts a Checkout', async () => {
      await request(server)
        .get('/subscriptions/mine')
        .set('Authorization', `Bearer ${coiffeurToken}`)
        .expect(200)
        .expect((res) => expect(res.body).toMatchObject({ state: 'none', listed: false, trialDays: 30, tier: 'solo', teamLimit: 1 }));

      await request(server)
        .get('/subscriptions/prices')
        .set('Authorization', `Bearer ${coiffeurToken}`)
        .expect(200)
        .expect((res) =>
          expect(res.body.map((price: { tier: string; plan: string; amount: number }) => [price.tier, price.plan, price.amount])).toEqual([
            ['solo', 'monthly', 29.99],
            ['solo', 'yearly', 239.88],
            ['team', 'monthly', 49.99],
            ['team', 'yearly', 479.88],
          ]),
        );

      await request(server)
        .post('/subscriptions/checkout-session')
        .set('Authorization', `Bearer ${coiffeurToken}`)
        .send({ tier: 'team', plan: 'yearly' })
        .expect(201)
        .expect((res) => expect(res.body.url).toMatch(/^https:\/\/checkout\.stripe\.test\//));
      // A website from before tiers sends the period alone: Solo.
      await request(server)
        .post('/subscriptions/checkout-session')
        .set('Authorization', `Bearer ${coiffeurToken}`)
        .send({ plan: 'monthly' })
        .expect(201);
    });

    it('rejects an unknown tier', async () => {
      await request(server)
        .post('/subscriptions/checkout-session')
        .set('Authorization', `Bearer ${coiffeurToken}`)
        .send({ tier: 'gold', plan: 'monthly' })
        .expect(400);
    });

    it('rejects an unknown plan, and the old in-app plan/cancel endpoints are gone', async () => {
      await request(server)
        .post('/subscriptions/checkout-session')
        .set('Authorization', `Bearer ${coiffeurToken}`)
        .send({ plan: 'lifetime' })
        .expect(400);
      await request(server).patch('/subscriptions/mine/cancel').set('Authorization', `Bearer ${coiffeurToken}`).expect(404);
    });

    it('is coiffeur-only', async () => {
      await request(server).get('/subscriptions/mine').set('Authorization', `Bearer ${particulierToken}`).expect(403);
    });
  });

  describe('POST /webhooks/stripe', () => {
    it("records Stripe's subscription from a signed event, without any user token", async () => {
      stripe.putSubscription({
        id: 'sub_1',
        customer: 'cus_1',
        status: 'active',
        profileId: coiffeur.id,
        currentPeriodEnd: Math.floor(Date.now() / 1000) + 30 * 86_400,
      });

      await signedWebhook({ id: 'evt_1', type: 'customer.subscription.created', data: { object: { id: 'sub_1' } } })
        .expect(200)
        .expect({ received: true });

      expect(harness.supabase.subscriptionFor(coiffeur.id)).toMatchObject({ status: 'active', stripe_subscription_id: 'sub_1' });
    });

    it('refuses a payload whose signature does not match', async () => {
      await request(server)
        .post('/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .set('Stripe-Signature', 't=1,v1=forged')
        .send(JSON.stringify({ id: 'evt_1', type: 'customer.subscription.created', data: { object: { id: 'sub_1' } } }))
        .expect(400);
    });
  });

  describe('admin', () => {
    it('lists subscriptions and sets the trial length', async () => {
      await request(server).get('/admin/subscriptions').set('Authorization', `Bearer ${adminToken}`).expect(200);

      await request(server)
        .patch('/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ trialDays: 14 })
        .expect(200)
        .expect({ trialDays: 14, commissionPercent: 10 });
      await request(server)
        .get('/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect({ trialDays: 14, commissionPercent: 10 });
    });

    it('refuses an impossible trial, and non-admins', async () => {
      await request(server)
        .patch('/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ trialDays: 400 })
        .expect(400);
      await request(server).get('/admin/settings').set('Authorization', `Bearer ${coiffeurToken}`).expect(403);
    });
  });
});
