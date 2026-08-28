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
    const created = await request(server)
      .post('/appointments')
      .set('Authorization', `Bearer ${particulierToken}`)
      .send({ coiffeurId: coiffeur.id, serviceId, startsAt: nextSlot().toISOString() })
      .expect(201);
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
    const created = await request(server)
      .post('/appointments')
      .set('Authorization', `Bearer ${particulierToken}`)
      .send({ coiffeurId: coiffeur.id, serviceId, startsAt: nextSlot().toISOString() })
      .expect(201);

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

  it('either side can cancel', async () => {
    const serviceId = await fetchServiceId();
    const created = await request(server)
      .post('/appointments')
      .set('Authorization', `Bearer ${particulierToken}`)
      .send({ coiffeurId: coiffeur.id, serviceId, startsAt: nextSlot().toISOString() })
      .expect(201);

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
