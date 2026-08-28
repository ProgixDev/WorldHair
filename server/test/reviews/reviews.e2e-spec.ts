import { randomUUID } from 'crypto';
import request from 'supertest';
import type { Server } from 'http';
import { createTestApp, TestApp } from '../utils/app-harness';

/** HTTP-level wiring for "Avis" — business rules are covered in depth by ReviewsService's own unit tests. */
describe('reviews (e2e)', () => {
  let harness: TestApp;
  let server: Server;

  const coiffeurToken = 'coiffeur-token';
  const coiffeur = { id: randomUUID(), email: 'sofia@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };

  const particulierToken = 'particulier-token';
  const particulier = { id: randomUUID(), email: 'fan@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };

  const adminToken = 'admin-token';
  const admin = { id: randomUUID(), email: 'admin@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };

  const PAST = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

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
    harness.supabase.addUser(adminToken, admin, 'admin');
  });

  afterEach(() => harness.resetDb());

  afterAll(() => harness.close());

  function seedDoneAppointment(): string {
    return harness.supabase.seedAppointment({
      particulierId: particulier.id,
      coiffeurId: coiffeur.id,
      startsAt: PAST,
      status: 'confirmed',
    });
  }

  it('rejects an unauthenticated request', async () => {
    await request(server).get('/reviews/me').expect(401);
  });

  it('creates a review, lists it publicly, and the coiffeur can reply', async () => {
    const appointmentId = seedDoneAppointment();
    const created = await request(server)
      .post('/reviews')
      .set('Authorization', `Bearer ${particulierToken}`)
      .send({ appointmentId, rating: 5, tags: ['Écoute'], comment: 'Super accueil.' })
      .expect(201);
    expect(created.body).toMatchObject({ authorName: 'Camille D.', rating: 5 });

    const publicList = await request(server).get(`/reviews/salon/${coiffeur.id}`).set(
      'Authorization',
      `Bearer ${particulierToken}`,
    );
    expect(publicList.status).toBe(200);
    expect(publicList.body).toHaveLength(1);

    await request(server)
      .patch(`/reviews/${created.body.id}/reply`)
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ text: 'Merci !' })
      .expect(200);

    const mine = await request(server)
      .get('/reviews/salon/mine')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .expect(200);
    expect(mine.body[0].reply).toBe('Merci !');
  });

  it('blocks a particulier from coiffeur-only and admin-only routes', async () => {
    const appointmentId = seedDoneAppointment();
    const created = await request(server)
      .post('/reviews')
      .set('Authorization', `Bearer ${particulierToken}`)
      .send({ appointmentId, rating: 4 })
      .expect(201);

    await request(server).get('/reviews/salon/mine').set('Authorization', `Bearer ${particulierToken}`).expect(403);
    await request(server)
      .patch(`/reviews/${created.body.id}/reply`)
      .set('Authorization', `Bearer ${particulierToken}`)
      .send({ text: 'Hey' })
      .expect(403);
    await request(server).get('/admin/reviews/reported').set('Authorization', `Bearer ${particulierToken}`).expect(403);
  });

  it('reports a review and lets an admin hide it', async () => {
    const appointmentId = seedDoneAppointment();
    const created = await request(server)
      .post('/reviews')
      .set('Authorization', `Bearer ${particulierToken}`)
      .send({ appointmentId, rating: 1, comment: 'Décevant.' })
      .expect(201);

    await request(server)
      .post(`/reviews/${created.body.id}/report`)
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ reason: 'Faux avis' })
      .expect(201);

    const reported = await request(server)
      .get('/admin/reviews/reported')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(reported.body).toHaveLength(1);

    await request(server)
      .patch(`/admin/reviews/${created.body.id}/moderate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'hide' })
      .expect(200);

    const publicList = await request(server)
      .get(`/reviews/salon/${coiffeur.id}`)
      .set('Authorization', `Bearer ${particulierToken}`)
      .expect(200);
    expect(publicList.body).toHaveLength(0);
  });

  it('rejects a malformed rating', async () => {
    const appointmentId = seedDoneAppointment();
    await request(server)
      .post('/reviews')
      .set('Authorization', `Bearer ${particulierToken}`)
      .send({ appointmentId, rating: 9 })
      .expect(400);
  });
});
