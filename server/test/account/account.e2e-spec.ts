import { randomUUID } from 'crypto';
import request from 'supertest';
import type { Server } from 'http';
import { createTestApp, TestApp } from '../utils/app-harness';

/** HTTP-level wiring for « Mes données » — the rules are covered by the services' unit tests. */
describe('account (e2e)', () => {
  let harness: TestApp;
  let server: Server;

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
    harness.supabase.addUser(particulierToken, particulier, 'particulier', { firstName: 'Camille', lastName: 'Durand' });
    harness.supabase.addUser(adminToken, admin, 'admin');
    harness.supabase.addUser(limitedToken, limited, 'admin_limited');
  });

  afterEach(() => harness.resetDb());

  afterAll(() => harness.close());

  it("exports the signed-in user's data as JSON", async () => {
    await request(server)
      .get('/users/me/export')
      .set('Authorization', `Bearer ${particulierToken}`)
      .expect(200)
      .expect('Content-Type', /json/)
      .expect((res) =>
        expect(res.body).toMatchObject({
          account: { id: particulier.id, email: particulier.email, firstName: 'Camille' },
          bookings: [],
        }),
      );
    await request(server).get('/users/me/export').expect(401);
  });

  it('deletes the account: its token stops working', async () => {
    await request(server).delete('/users/me').set('Authorization', `Bearer ${particulierToken}`).expect(204);

    await request(server).get('/users/me').set('Authorization', `Bearer ${particulierToken}`).expect(401);
    expect(harness.supabase.profileFor(particulier.id)).toBeUndefined();
  });

  it('hands out a download link for a large export', async () => {
    await request(server)
      .post('/users/me/export/link')
      .set('Authorization', `Bearer ${particulierToken}`)
      .expect(200)
      .expect((res) => expect(res.body).toMatchObject({ url: expect.stringContaining('data-exports'), expiresAt: expect.any(String) }));
  });

  it('lets the top admin tier delete a client or salon account — a request received by e-mail', async () => {
    await request(server).delete(`/admin/accounts/${particulier.id}`).set('Authorization', `Bearer ${limitedToken}`).expect(403);
    await request(server).delete(`/admin/accounts/${limited.id}`).set('Authorization', `Bearer ${adminToken}`).expect(400);
    await request(server).delete(`/admin/accounts/${randomUUID()}`).set('Authorization', `Bearer ${adminToken}`).expect(404);

    await request(server).delete(`/admin/accounts/${particulier.id}`).set('Authorization', `Bearer ${adminToken}`).expect(204);
    expect(harness.supabase.profileFor(particulier.id)).toBeUndefined();
  });

  it("doesn't delete an admin account from here", async () => {
    await request(server).delete('/users/me').set('Authorization', `Bearer ${adminToken}`).expect(403);
    await request(server).get('/users/me/export').set('Authorization', `Bearer ${adminToken}`).expect(403);
    expect(harness.supabase.profileFor(admin.id)).toBeDefined();
  });
});
