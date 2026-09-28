import { randomUUID } from 'crypto';
import request from 'supertest';
import type { Server } from 'http';
import { createTestApp, TestApp } from '../utils/app-harness';

/** A client's hearts on salons (TODO.md Phase 6), over HTTP. */
describe('favorites (e2e)', () => {
  let harness: TestApp;
  let server: Server;

  const particulierToken = 'particulier-token';
  const particulier = { id: randomUUID(), email: 'fan@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };
  const coiffeurToken = 'coiffeur-token';
  const coiffeur = { id: randomUUID(), email: 'sofia@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };

  beforeAll(async () => {
    harness = await createTestApp();
    server = harness.app.getHttpServer() as Server;
  });

  beforeEach(() => {
    harness.supabase.addUser(particulierToken, particulier, 'particulier');
    harness.supabase.addUser(coiffeurToken, coiffeur, 'coiffeur');
    harness.supabase.seedValidatedSalon({ profileId: coiffeur.id, firstName: 'Sofia', lastName: 'Benali', salonName: 'Studio W' });
  });

  afterEach(() => harness.resetDb());

  afterAll(() => harness.close());

  it('keeps a heart on a salon, lists it, and takes it off', async () => {
    const auth = { Authorization: `Bearer ${particulierToken}` };

    await request(server).post('/favorites').set(auth).send({ coiffeurId: coiffeur.id }).expect(204);
    await request(server)
      .get('/favorites')
      .query({ lat: 48.86, lng: 2.34 })
      .set(auth)
      .expect(200)
      .expect((res) => expect(res.body).toEqual([expect.objectContaining({ id: coiffeur.id, salonName: 'Studio W' })]));

    await request(server).delete(`/favorites/${coiffeur.id}`).set(auth).expect(204);
    expect(harness.supabase.favoritesOf(particulier.id)).toEqual([]);
  });

  it("refuses a salon that isn't listed, a bad id, and anyone but a client", async () => {
    const auth = { Authorization: `Bearer ${particulierToken}` };

    await request(server).post('/favorites').set(auth).send({ coiffeurId: randomUUID() }).expect(404);
    await request(server).post('/favorites').set(auth).send({ coiffeurId: 'not-a-uuid' }).expect(400);
    await request(server).get('/favorites').set('Authorization', `Bearer ${coiffeurToken}`).expect(403);
  });
});
