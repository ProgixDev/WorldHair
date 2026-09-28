import { randomUUID } from 'crypto';
import request from 'supertest';
import type { Server } from 'http';
import Stripe from 'stripe';
import { createTestApp, TestApp } from '../utils/app-harness';

/** Same values as test-env.ts: specs sign webhook payloads with them, the app checks them for real. */
const PLATFORM_SECRET = 'whsec_test_secret';
const CONNECT_SECRET = 'whsec_test_connect_secret';

/** HTTP-level wiring for payments — the rules are covered by the services' unit tests. */
describe('payments (e2e)', () => {
  let harness: TestApp;
  let server: Server;

  const coiffeurToken = 'coiffeur-token';
  const coiffeur = { id: randomUUID(), email: 'sofia@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };
  const particulierToken = 'particulier-token';
  const particulier = { id: randomUUID(), email: 'fan@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };
  const adminToken = 'admin-token';
  const admin = { id: randomUUID(), email: 'admin@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };

  /** Next Wednesday 10:00 — inside the Mon-Sat 9-19 default availability, always in the future. */
  function nextSlot(): string {
    const date = new Date();
    date.setHours(10, 0, 0, 0);
    date.setDate(date.getDate() + 1);
    while (date.getDay() !== 3) date.setDate(date.getDate() + 1);
    return date.toISOString();
  }

  beforeAll(async () => {
    harness = await createTestApp();
    server = harness.app.getHttpServer() as Server;
  });

  beforeEach(() => {
    harness.supabase.addUser(coiffeurToken, coiffeur, 'coiffeur');
    harness.supabase.addUser(particulierToken, particulier, 'particulier', { firstName: 'Camille', lastName: 'Durand' });
    harness.supabase.addUser(adminToken, admin, 'admin');
    harness.supabase.seedValidatedSalon({
      profileId: coiffeur.id,
      firstName: 'Sofia',
      lastName: 'Benali',
      salonName: 'Studio W',
      services: [{ name: 'Coupe & brushing', price: 40, durationMin: 60, specialty: 'coupe' }],
    });
  });

  afterEach(() => harness.resetDb());

  afterAll(() => harness.close());

  function signed(path: string, secret: string, payload: object) {
    const body = JSON.stringify(payload);
    return request(server)
      .post(path)
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', Stripe.webhooks.generateTestHeaderString({ payload: body, secret }))
      .send(body);
  }

  async function hold(): Promise<string> {
    const services = await request(server).get('/salon/me/services').set('Authorization', `Bearer ${coiffeurToken}`);
    const held = await request(server)
      .post('/appointments')
      .set('Authorization', `Bearer ${particulierToken}`)
      .send({ coiffeurId: coiffeur.id, serviceIds: [services.body[0].id], startsAt: nextSlot() })
      .expect(201);
    return held.body.appointment.id as string;
  }

  it("sends the request when Stripe's webhook says the card went through", async () => {
    const id = await hold();
    const intent = harness.stripe.succeedIntent(harness.supabase.paymentFor(id)!.payment_intent_id);

    await signed('/webhooks/stripe', PLATFORM_SECRET, { id: 'evt_1', type: 'payment_intent.succeeded', data: { object: intent } })
      .expect(200);

    const salon = await request(server).get('/appointments/salon').set('Authorization', `Bearer ${coiffeurToken}`).expect(200);
    expect(salon.body).toEqual([expect.objectContaining({ id, status: 'pending' })]);
  });

  it('frees the held slot when the client leaves the payment step', async () => {
    const id = await hold();

    await request(server).post(`/appointments/${id}/release`).set('Authorization', `Bearer ${particulierToken}`).expect(204);

    expect(harness.supabase.paymentFor(id)).toBeUndefined();
  });

  it("records a salon's payouts from the Connect endpoint, whose own secret is the only one it takes", async () => {
    harness.supabase.seedPayoutAccount({ profileId: coiffeur.id, stripeAccountId: 'acct_1', payoutsEnabled: false });
    const event = {
      id: 'evt_2',
      type: 'account.updated',
      data: { object: { id: 'acct_1', details_submitted: true, charges_enabled: true, payouts_enabled: true } },
    };

    await signed('/webhooks/stripe/connect', PLATFORM_SECRET, event).expect(400);
    await signed('/webhooks/stripe/connect', CONNECT_SECRET, event).expect(200);

    expect(harness.supabase.payoutAccountFor(coiffeur.id)).toMatchObject({ payouts_enabled: true });
  });

  it("gives the coiffeur Stripe's onboarding link and their payout status", async () => {
    harness.supabase.seedPayoutAccount({ profileId: coiffeur.id, stripeAccountId: null, payoutsEnabled: false });

    await request(server)
      .get('/payments/connect/status')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .expect(200)
      .expect((res) => expect(res.body).toMatchObject({ state: 'none', onlineBooking: false }));
    await request(server)
      .post('/payments/connect/onboarding-link')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .expect(200)
      .expect((res) => expect(res.body.url).toMatch(/^https:\/\/connect\.stripe\.test\//));
    await request(server).get('/payments/connect/status').set('Authorization', `Bearer ${particulierToken}`).expect(403);
  });

  it('lets the admin see every payment and refund one', async () => {
    const id = await hold();
    harness.stripe.succeedIntent(harness.supabase.paymentFor(id)!.payment_intent_id);
    await request(server).post(`/appointments/${id}/payment/confirm`).set('Authorization', `Bearer ${particulierToken}`).expect(200);

    await request(server)
      .get('/admin/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => expect(res.body).toEqual([expect.objectContaining({ appointmentId: id, amount: 40, salonName: 'Studio W' })]));
    await request(server)
      .post(`/admin/payments/${id}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 10 })
      .expect(200)
      .expect({ refunded: 10 });
    await request(server).get('/admin/payments').set('Authorization', `Bearer ${coiffeurToken}`).expect(403);
  });
});
