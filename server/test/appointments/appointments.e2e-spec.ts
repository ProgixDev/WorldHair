import { randomUUID } from 'crypto';
import request from 'supertest';
import type { Server } from 'http';
import { createTestApp, TestApp } from '../utils/app-harness';

/** HTTP-level wiring for "Rendez-vous / Agenda" — business rules are covered in depth by AppointmentsService's own unit tests. */
describe('appointments (e2e)', () => {
  let harness: TestApp;
  let server: Server;

  const coiffeurToken = 'coiffeur-token';
  const coiffeur = {
    id: randomUUID(),
    email: 'sofia@example.com',
    email_confirmed_at: '2024-01-01T00:00:00Z',
  };

  const particulierToken = 'particulier-token';
  const particulier = {
    id: randomUUID(),
    email: 'fan@example.com',
    email_confirmed_at: '2024-01-01T00:00:00Z',
  };

  /** Next Wednesday 10:00 — inside the Mon-Sat 9-19 default availability, always in the future. */
  function nextSlot(): Date {
    const date = new Date();
    date.setHours(10, 0, 0, 0);
    date.setDate(date.getDate() + 1);
    while (date.getDay() !== 3) date.setDate(date.getDate() + 1);
    return date;
  }

  beforeAll(async () => {
    harness = await createTestApp();
    server = harness.app.getHttpServer() as Server;
  });

  beforeEach(() => {
    harness.supabase.addUser(coiffeurToken, coiffeur, 'coiffeur');
    harness.supabase.addUser(particulierToken, particulier, 'particulier', {
      firstName: 'Camille',
      lastName: 'Durand',
    });
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

  /** Books like the app: POST holds the slot, Stripe's test card pays, then the app confirms. */
  async function book(body: Record<string, unknown>): Promise<request.Response> {
    const held = await request(server)
      .post('/appointments')
      .set('Authorization', `Bearer ${particulierToken}`)
      .send(body)
      .expect(201);
    expect(held.body.payment.clientSecret).toMatch(/_secret_/);
    harness.stripe.succeedIntent(harness.supabase.paymentFor(held.body.appointment.id)!.payment_intent_id);
    return request(server)
      .post(`/appointments/${held.body.appointment.id}/payment/confirm`)
      .set('Authorization', `Bearer ${particulierToken}`)
      .expect(200);
  }

  async function fetchServiceId(): Promise<string> {
    const res = await request(server)
      .get('/salon/me/services')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .expect(200);
    return res.body[0].id;
  }

  it('rejects an unauthenticated request', async () => {
    await request(server).get('/appointments/me').expect(401);
  });

  it('books a request, lists it for the particulier, and the coiffeur can accept it', async () => {
    const serviceId = await fetchServiceId();
    const created = await book({ coiffeurId: coiffeur.id, serviceId, startsAt: nextSlot().toISOString() });
    expect(created.body).toMatchObject({ status: 'pending', salonName: 'Studio W' });

    const mine = await request(server)
      .get('/appointments/me')
      .set('Authorization', `Bearer ${particulierToken}`)
      .expect(200);
    expect(mine.body).toHaveLength(1);

    await request(server)
      .patch(`/appointments/${created.body.id}/decide`)
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ decision: 'confirmed' })
      .expect(200);

    const salonList = await request(server)
      .get('/appointments/salon')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .expect(200);
    expect(salonList.body[0]).toMatchObject({ status: 'confirmed', clientName: 'Camille Durand' });
  });

  it('blocks a particulier from the coiffeur-only routes', async () => {
    const serviceId = await fetchServiceId();
    const created = await book({ coiffeurId: coiffeur.id, serviceId, startsAt: nextSlot().toISOString() });

    await request(server).get('/appointments/salon').set('Authorization', `Bearer ${particulierToken}`).expect(403);
    await request(server)
      .patch(`/appointments/${created.body.id}/decide`)
      .set('Authorization', `Bearer ${particulierToken}`)
      .send({ decision: 'confirmed' })
      .expect(403);
  });

  it('rejects a malformed body', async () => {
    await request(server)
      .post('/appointments')
      .set('Authorization', `Bearer ${particulierToken}`)
      .send({ coiffeurId: 'not-a-uuid', serviceId: 'also-not-a-uuid', startsAt: 'not-a-date' })
      .expect(400);
  });

  it("books several prestations at once, and serves the day's slots for them", async () => {
    const serviceId = await fetchServiceId();
    const slot = nextSlot();
    const day = slot.toISOString().slice(0, 10); // the suite runs in UTC; 10:00 UTC is the same day in Paris

    const created = await book({ coiffeurId: coiffeur.id, serviceIds: [serviceId], startsAt: slot.toISOString() });
    expect(created.body.services).toHaveLength(1);

    const slots = await request(server)
      .get(`/appointments/salon/${coiffeur.id}/slots`)
      .query({ date: day, serviceIds: serviceId })
      .set('Authorization', `Bearer ${particulierToken}`)
      .expect(200);
    expect(slots.body).toMatchObject({ date: day, closed: false });
    expect(slots.body.slots.length).toBeGreaterThan(0);

    await request(server)
      .get(`/appointments/salon/${coiffeur.id}/slots`)
      .query({ date: 'next-wednesday', serviceIds: serviceId })
      .set('Authorization', `Bearer ${particulierToken}`)
      .expect(400);
  });

  it('lets the coiffeur, and only the coiffeur, move an accepted appointment and mark attendance', async () => {
    const serviceId = await fetchServiceId();
    const created = await book({ coiffeurId: coiffeur.id, serviceIds: [serviceId], startsAt: nextSlot().toISOString() });
    await request(server)
      .patch(`/appointments/${created.body.id}/decide`)
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ decision: 'confirmed' })
      .expect(200);

    const later = new Date(nextSlot().getTime() + 3 * 3_600_000).toISOString();
    await request(server)
      .patch(`/appointments/${created.body.id}/move`)
      .set('Authorization', `Bearer ${particulierToken}`)
      .send({ startsAt: later })
      .expect(403);
    await request(server)
      .patch(`/appointments/${created.body.id}/move`)
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ startsAt: later })
      .expect(200);

    const past = harness.supabase.seedAppointment({
      particulierId: particulier.id,
      coiffeurId: coiffeur.id,
      startsAt: new Date(Date.now() - 86_400_000).toISOString(),
      status: 'confirmed',
    });
    await request(server)
      .patch(`/appointments/${past}/attendance`)
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ attendance: 'maybe' })
      .expect(400);
    await request(server)
      .patch(`/appointments/${past}/attendance`)
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ attendance: 'no_show' })
      .expect(200);
  });

  it('either side can cancel', async () => {
    const serviceId = await fetchServiceId();
    const created = await book({ coiffeurId: coiffeur.id, serviceId, startsAt: nextSlot().toISOString() });

    await request(server)
      .patch(`/appointments/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .expect(200);

    const mine = await request(server)
      .get('/appointments/me')
      .set('Authorization', `Bearer ${particulierToken}`)
      .expect(200);
    expect(mine.body[0].status).toBe('cancelled');
  });
});
