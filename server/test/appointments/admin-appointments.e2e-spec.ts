import { randomUUID } from 'crypto';
import request from 'supertest';
import type { Server } from 'http';
import { createTestApp, TestApp } from '../utils/app-harness';

/** HTTP-level wiring for the admins' « Rendez-vous » — the rules are covered by the services' unit tests. */
describe('admin appointments (e2e)', () => {
  let harness: TestApp;
  let server: Server;

  const coiffeurToken = 'coiffeur-token';
  const coiffeur = { id: randomUUID(), email: 'sofia@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };
  const particulierToken = 'particulier-token';
  const particulier = { id: randomUUID(), email: 'fan@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };
  const adminToken = 'admin-token';
  const admin = { id: randomUUID(), email: 'admin@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };
  const limitedToken = 'limited-token';
  const limited = { id: randomUUID(), email: 'moderation@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };

  beforeAll(async () => {
    harness = await createTestApp();
    server = harness.app.getHttpServer() as Server;
  });

  beforeEach(() => {
    harness.supabase.addUser(coiffeurToken, coiffeur, 'coiffeur');
    harness.supabase.addUser(particulierToken, particulier, 'particulier', { firstName: 'Camille', lastName: 'Durand' });
    harness.supabase.addUser(adminToken, admin, 'admin');
    harness.supabase.addUser(limitedToken, limited, 'admin_limited');
    harness.supabase.seedValidatedSalon({ profileId: coiffeur.id, firstName: 'Sofia', lastName: 'Benali', salonName: 'Studio W' });
  });

  afterEach(() => harness.resetDb());

  afterAll(() => harness.close());

  /** An accepted booking in two days, paid in the app. */
  function seedPaidBooking(): string {
    const id = harness.supabase.seedAppointment({
      particulierId: particulier.id,
      coiffeurId: coiffeur.id,
      startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      status: 'confirmed',
      price: 40,
    });
    harness.supabase.seedPayment({ appointmentId: id, particulierId: particulier.id, coiffeurId: coiffeur.id, amount: 40 });
    return id;
  }

  it('lists, filters and shows the bookings to both admin tiers, and to no one else', async () => {
    const id = seedPaidBooking();

    await request(server)
      .get('/admin/appointments?status=upcoming&salon=studio&client=camille&limit=10&offset=0')
      .set('Authorization', `Bearer ${limitedToken}`)
      .expect(200)
      .expect((res) =>
        expect(res.body).toMatchObject({
          total: 1,
          items: [{ id, salon: { name: 'Studio W' }, client: { name: 'Camille Durand' }, payment: { amount: 40 } }],
        }),
      );
    await request(server)
      .get('/admin/appointments?status=cancelled')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect({ items: [], total: 0 });
    await request(server)
      .get(`/admin/appointments/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => expect(res.body).toMatchObject({ id, status: 'confirmed', client: { email: 'fan@example.com' } }));

    await request(server).get('/admin/appointments').set('Authorization', `Bearer ${coiffeurToken}`).expect(403);
    await request(server).get('/admin/appointments').set('Authorization', `Bearer ${particulierToken}`).expect(403);
    await request(server).get('/admin/appointments').expect(401);
  });

  it('rejects a malformed filter, and an unknown booking', async () => {
    for (const query of ['status=soon', 'from=2026-02-30', 'to=demain', 'limit=500', 'salon=' + 'x'.repeat(101)]) {
      await request(server).get(`/admin/appointments?${query}`).set('Authorization', `Bearer ${adminToken}`).expect(400);
    }
    await request(server).get(`/admin/appointments/${randomUUID()}`).set('Authorization', `Bearer ${adminToken}`).expect(404);
    await request(server).get('/admin/appointments/not-an-id').set('Authorization', `Bearer ${adminToken}`).expect(400);
  });

  it('cancels a booking with a reason and refunds it — once', async () => {
    const id = seedPaidBooking();
    const cancel = (token: string, body: object) =>
      request(server).patch(`/admin/appointments/${id}/cancel`).set('Authorization', `Bearer ${token}`).send(body);

    await cancel(adminToken, {}).expect(400);
    await cancel(adminToken, { reason: '     ' }).expect(400);
    await cancel(adminToken, { reason: 'x'.repeat(501) }).expect(400);
    await cancel(coiffeurToken, { reason: 'Litige client' }).expect(403);

    await cancel(adminToken, { reason: 'Litige client' }).expect(200).expect({ refunded: 40, refundFailed: false });
    await cancel(adminToken, { reason: 'Litige client' }).expect(400);
    await request(server)
      .get(`/admin/appointments/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) =>
        expect(res.body).toMatchObject({
          status: 'cancelled',
          cancelledBy: 'admin',
          cancellationReason: 'Litige client',
          payment: { refundedAmount: 40 },
        }),
      );
  });
});
