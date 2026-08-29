import request from 'supertest';
import type { Server } from 'http';
import { createTestApp, TestApp } from '../utils/app-harness';

/** HTTP-level wiring for "Notifications" push-token registration and preferences. */
describe('notifications (e2e)', () => {
  let harness: TestApp;
  let server: Server;

  const token = 'particulier-token';
  const user = { id: 'particulier-1', email: 'fan@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };

  beforeAll(async () => {
    harness = await createTestApp();
    server = harness.app.getHttpServer() as Server;
  });

  beforeEach(() => {
    harness.supabase.addUser(token, user, 'particulier');
  });

  afterEach(() => harness.resetDb());

  afterAll(() => harness.close());

  it('rejects an unauthenticated request', async () => {
    await request(server).get('/notifications/preferences').expect(401);
  });

  it('defaults both reminders to enabled, then persists a partial update', async () => {
    const defaults = await request(server)
      .get('/notifications/preferences')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(defaults.body).toEqual({ reminderDayBefore: true, reminderHourBefore: true });

    const updated = await request(server)
      .patch('/notifications/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ reminderDayBefore: false })
      .expect(200);
    expect(updated.body).toEqual({ reminderDayBefore: false, reminderHourBefore: true });

    const reread = await request(server)
      .get('/notifications/preferences')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(reread.body).toEqual(updated.body);
  });

  it('registers and unregisters a push token', async () => {
    const pushToken = 'ExponentPushToken[fake-e2e-token]';
    await request(server)
      .post('/notifications/push-tokens')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: pushToken, platform: 'ios', timezone: 'Europe/Paris' })
      .expect(201);

    await request(server)
      .delete(`/notifications/push-tokens/${encodeURIComponent(pushToken)}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('rejects an unknown platform', async () => {
    await request(server)
      .post('/notifications/push-tokens')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'ExponentPushToken[fake-e2e-token]', platform: 'windows-phone' })
      .expect(400);
  });
});
