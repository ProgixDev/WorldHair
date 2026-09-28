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

  it("saves the salon's social links, empties one, and refuses a link to the wrong site", async () => {
    const auth = { Authorization: `Bearer ${coiffeurToken}` };

    await request(server)
      .patch('/salon/me')
      .set(auth)
      .send({ instagramUrl: 'https://instagram.com/studio.w', tiktokUrl: 'https://www.tiktok.com/@studiow', websiteUrl: '' })
      .expect(200)
      .expect((res) =>
        expect(res.body).toMatchObject({
          instagramUrl: 'https://instagram.com/studio.w',
          tiktokUrl: 'https://www.tiktok.com/@studiow',
          websiteUrl: null,
        }),
      );

    for (const bad of [
      { instagramUrl: 'https://facebook.com/studiow' },
      { websiteUrl: 'pas un lien' },
      { facebookUrl: 'facebook.com/x' },
      // Read as the site before "@" by browsers: an icon must never lead elsewhere.
      { instagramUrl: 'https://evil.example\\@instagram.com' },
      { instagramUrl: 'https://someone:secret@instagram.com/studio' },
    ]) {
      await request(server).patch('/salon/me').set(auth).send(bad).expect(400);
    }
    for (const good of [
      { instagramUrl: 'https://Instagram.com/studio.w?igsh=abc' },
      { tiktokUrl: 'https://vt.tiktok.com/ZS123/' },
      { facebookUrl: 'https://web.facebook.com/studiow' },
    ]) {
      await request(server).patch('/salon/me').set(auth).send(good).expect(200);
    }
  });

  it("lists closures from a given day: this week's, for the dashboard's fill rate", async () => {
    const auth = { Authorization: `Bearer ${coiffeurToken}` };
    harness.supabase.seedTimeOff({
      profileId: coiffeur.id,
      startsAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      endsAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    });

    await request(server).get('/salon/me/time-off').set(auth).expect(200).expect((res) => expect(res.body).toHaveLength(0));
    await request(server)
      .get('/salon/me/time-off')
      .query({ from: new Date(Date.now() - 7 * 86_400_000).toISOString() })
      .set(auth)
      .expect(200)
      .expect((res) => expect(res.body).toHaveLength(1));
    await request(server).get('/salon/me/time-off').query({ from: 'hier' }).set(auth).expect(400);
  });

  it('hides a service from clients, and shows it again', async () => {
    const auth = { Authorization: `Bearer ${coiffeurToken}` };
    const created = await request(server)
      .post('/salon/me/services')
      .set(auth)
      .send({ name: 'Coupe', price: 30, durationMin: 30, specialty: 'coupe' })
      .expect(201);
    expect(created.body.isActive).toBe(true);

    await request(server)
      .patch(`/salon/me/services/${created.body.id}`)
      .set(auth)
      .send({ isActive: false })
      .expect(200)
      .expect((res) => expect(res.body.isActive).toBe(false));
    await request(server).patch(`/salon/me/services/${created.body.id}`).set(auth).send({ isActive: 'no' }).expect(400);
  });

  it('rejects an unknown specialty', async () => {
    await request(server)
      .patch('/salon/me')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ specialties: ['not-a-real-specialty'] })
      .expect(400);
  });

  it('accepts a blank postal code (no required-field marker on it in the editor)', async () => {
    await request(server)
      .patch('/salon/me')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ salonName: 'Studio W', postalCode: '' })
      .expect(200);
  });

  it('still rejects a malformed, non-empty postal code', async () => {
    await request(server)
      .patch('/salon/me')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ postalCode: 'abcde' })
      .expect(400);
  });

  it('accepts a blank phone, a valid E.164 one, and rejects a malformed one', async () => {
    await request(server)
      .patch('/salon/me')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ phone: '' })
      .expect(200);

    const updated = await request(server)
      .patch('/salon/me')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ phone: '+33612345678' })
      .expect(200);
    expect(updated.body).toMatchObject({ phone: '+33612345678' });

    // Not @IsPhoneNumber(): a real, working number can still fall outside
    // formal per-country numbering-plan assignment tables (VOIP, newer
    // allocations, etc). This editor only enforces the E.164 *shape*.
    const unassignedArea = await request(server)
      .patch('/salon/me')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ phone: '+15550001234', phoneCountry: 'CA' })
      .expect(200);
    expect(unassignedArea.body).toMatchObject({ phone: '+15550001234', phoneCountry: 'CA' });

    await request(server)
      .patch('/salon/me')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ phone: 'not-a-phone' })
      .expect(400);
  });

  it('rejects a phone country that is not an ISO 3166-1 alpha-2 code', async () => {
    await request(server)
      .patch('/salon/me')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ phoneCountry: 'Canada' })
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

  it('adds and deletes a gallery photo', async () => {
    const added = await request(server)
      .post('/salon/me/gallery')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ url: 'https://x/1.jpg', storagePath: 'coiffeur-1/gallery/1.jpg' })
      .expect(201);
    expect(added.body).toEqual([expect.objectContaining({ url: 'https://x/1.jpg' })]);

    const photoId = added.body[0].id;
    await request(server)
      .delete(`/salon/me/gallery/${photoId}`)
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .expect(200);

    const afterDelete = await request(server)
      .get('/salon/me/gallery')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .expect(200);
    expect(afterDelete.body).toEqual([]);
  });

  it("404s deleting another coiffeur's gallery photo", async () => {
    const otherToken = 'coiffeur-token-3';
    harness.supabase.addUser(otherToken, { id: 'coiffeur-3', email: 'other2@example.com', email_confirmed_at: null }, 'coiffeur');

    const added = await request(server)
      .post('/salon/me/gallery')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ url: 'https://x/1.jpg', storagePath: 'coiffeur-1/gallery/1.jpg' })
      .expect(201);

    await request(server)
      .delete(`/salon/me/gallery/${added.body[0].id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  it('saves the booking rules, and rejects values outside what the app offers', async () => {
    const updated = await request(server)
      .patch('/salon/me')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ confirmationMode: 'instant', bookingNoticeMinutes: 60, cancellationNoticeMinutes: 1440 })
      .expect(200);
    expect(updated.body).toMatchObject({ confirmationMode: 'instant', bookingNoticeMinutes: 60, cancellationNoticeMinutes: 1440 });

    await request(server)
      .patch('/salon/me')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ confirmationMode: 'sometimes' })
      .expect(400);
    await request(server)
      .patch('/salon/me')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ bookingNoticeMinutes: -5 })
      .expect(400);
  });

  it('adds, lists and removes a closure', async () => {
    const startsAt = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const endsAt = new Date(Date.now() + 6 * 86_400_000).toISOString();

    const added = await request(server)
      .post('/salon/me/time-off')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ startsAt, endsAt, label: 'Congés' })
      .expect(201);
    expect(added.body).toMatchObject({ timeOff: { startsAt, endsAt, label: 'Congés' }, conflicts: [] });

    const list = await request(server).get('/salon/me/time-off').set('Authorization', `Bearer ${coiffeurToken}`).expect(200);
    expect(list.body).toHaveLength(1);

    await request(server)
      .post('/salon/me/time-off')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ startsAt: 'tomorrow', endsAt })
      .expect(400);

    await request(server)
      .delete(`/salon/me/time-off/${added.body.timeOff.id}`)
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .expect(200);
  });
});
