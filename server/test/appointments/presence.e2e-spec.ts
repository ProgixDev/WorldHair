import request from 'supertest';
import type { Server } from 'http';
import { createTestApp, TestApp } from '../utils/app-harness';

/** The end-of-service code through the real HTTP stack: the salon shows it, the client scans it. */
describe('presence (e2e)', () => {
  let harness: TestApp;
  let server: Server;

  const salon = { id: '11111111-1111-4111-8111-111111111111', email: 'sofia@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };
  const camille = { id: '33333333-3333-4333-8333-333333333333', email: 'camille@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };
  const awa = { id: '44444444-4444-4444-8444-444444444444', email: 'awa@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    harness = await createTestApp();
    server = harness.app.getHttpServer() as Server;
  });

  beforeEach(() => {
    harness.supabase.addUser('salon-token', salon, 'coiffeur');
    harness.supabase.seedValidatedSalon({ profileId: salon.id, firstName: 'Sofia', lastName: 'Benali', salonName: 'Studio W' });
    harness.supabase.addUser('camille-token', camille, 'particulier', { firstName: 'Camille', lastName: 'Durand' });
    harness.supabase.addUser('awa-token', awa, 'particulier');
  });

  afterEach(() => harness.resetDb());
  afterAll(() => harness.close());

  const bookingInProgress = () =>
    harness.supabase.seedAppointment({
      particulierId: camille.id,
      coiffeurId: salon.id,
      startsAt: new Date(Date.now() - 30 * 60_000).toISOString(),
      durationMin: 60,
      status: 'confirmed',
    });

  it('shows a code to the salon, and lets only the booking’s client confirm with it', async () => {
    const id = bookingInProgress();
    const shown = await request(server).post(`/presence/${id}/code`).set(as('salon-token')).expect(201);
    expect(shown.body.code).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);

    await request(server).post('/presence/confirm').set(as('awa-token')).send({ code: shown.body.code }).expect(403);
    await request(server).post('/presence/confirm').set(as('salon-token')).send({ code: shown.body.code }).expect(403);
    await request(server)
      .post('/presence/confirm')
      .set(as('camille-token'))
      .send({ code: shown.body.code })
      .expect(200)
      .expect((res) => expect(res.body).toMatchObject({ appointmentId: id, salonName: 'Studio W' }));

    await request(server)
      .get(`/presence/${id}/status`)
      .set(as('salon-token'))
      .expect(200)
      .expect((res) => expect(res.body.confirmedByClientAt).toEqual(expect.any(String)));
  });

  it('keeps the salon’s routes to the salon and the client’s to clients, and refuses a wrong code', async () => {
    const id = bookingInProgress();
    await request(server).post(`/presence/${id}/code`).set(as('camille-token')).expect(403);
    await request(server).get(`/presence/${id}/status`).set(as('camille-token')).expect(403);
    await request(server).post('/presence/confirm').set(as('camille-token')).send({ code: 'ZZZZZZZZZZZZ' }).expect(404);
    await request(server).post('/presence/confirm').set(as('camille-token')).send({ code: 'short' }).expect(400);
    await request(server).post('/presence/confirm').send({ code: 'ZZZZZZZZZZZZ' }).expect(401);
  });
});
