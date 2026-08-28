import request from 'supertest';
import type { Server } from 'http';
import { createTestApp, TestApp } from '../utils/app-harness';

/** Exercises the coiffeur's "Mon salon" workspace end to end, including the `@Roles('coiffeur')` gate. */
describe('salon (e2e)', () => {
  let harness: TestApp;
  let server: Server;

  const coiffeurToken = 'coiffeur-token';
  const coiffeur = { id: 'coiffeur-1', email: 'sofia@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };

  const particulierToken = 'particulier-token';
  const particulier = { id: 'particulier-1', email: 'fan@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };

  beforeAll(async () => {
    harness = await createTestApp();
    server = harness.app.getHttpServer() as Server;
  });

  beforeEach(() => {
    harness.supabase.addUser(coiffeurToken, coiffeur, 'coiffeur');
    harness.supabase.addUser(particulierToken, particulier, 'particulier');
  });

  afterEach(() => harness.resetDb());

  afterAll(() => harness.close());

  it('blocks a particulier from the whole /salon/me surface', async () => {
    await request(server).get('/salon/me').set('Authorization', `Bearer ${particulierToken}`).expect(403);
    await request(server)
      .patch('/salon/me')
      .set('Authorization', `Bearer ${particulierToken}`)
      .send({ salonName: 'Nope' })
      .expect(403);
  });

  it('returns an empty profile before anything is saved, then the update after PATCH', async () => {
    const empty = await request(server)
      .get('/salon/me')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .expect(200);
    expect(empty.body).toMatchObject({ salonName: '', specialties: [] });

    const updated = await request(server)
      .patch('/salon/me')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ salonName: 'Studio W', specialties: ['coupe', 'afro'] })
      .expect(200);
    expect(updated.body).toMatchObject({ salonName: 'Studio W', specialties: ['coupe', 'afro'] });
  });

  it('rejects an unknown specialty', async () => {
    await request(server)
      .patch('/salon/me')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ specialties: ['not-a-real-specialty'] })
      .expect(400);
  });

  it('returns a sensible default week, then the saved one after PUT', async () => {
    const defaults = await request(server)
      .get('/salon/me/availability')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .expect(200);
    expect(defaults.body).toHaveLength(7);

    const days = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      isOpen: false,
      opensMinute: 540,
      closesMinute: 1140,
      breakStartMinute: null,
      breakEndMinute: null,
    }));

    const saved = await request(server)
      .put('/salon/me/availability')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ days })
      .expect(200);
    expect(saved.body.every((d: { isOpen: boolean }) => d.isOpen === false)).toBe(true);
  });

  it('creates, updates and deletes a service (prestation)', async () => {
    const created = await request(server)
      .post('/salon/me/services')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ name: 'Coupe & brushing', price: 40, durationMin: 45, specialty: 'coupe' })
      .expect(201);
    expect(created.body).toMatchObject({ name: 'Coupe & brushing', price: 40, durationMin: 45 });

    const updated = await request(server)
      .patch(`/salon/me/services/${created.body.id}`)
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ price: 45 })
      .expect(200);
    expect(updated.body).toMatchObject({ id: created.body.id, price: 45 });

    const list = await request(server)
      .get('/salon/me/services')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .expect(200);
    expect(list.body).toEqual([updated.body]);

    await request(server)
      .delete(`/salon/me/services/${created.body.id}`)
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .expect(200);

    const afterDelete = await request(server)
      .get('/salon/me/services')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .expect(200);
    expect(afterDelete.body).toEqual([]);
  });

  it("404s updating another coiffeur's service", async () => {
    const otherToken = 'coiffeur-token-2';
    harness.supabase.addUser(otherToken, { id: 'coiffeur-2', email: 'other@example.com', email_confirmed_at: null }, 'coiffeur');

    const created = await request(server)
      .post('/salon/me/services')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ name: 'Coupe', price: 30, durationMin: 30, specialty: 'coupe' })
      .expect(201);

    await request(server)
      .patch(`/salon/me/services/${created.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ price: 99 })
      .expect(404);
  });
});
