import request from 'supertest';
import type { Server } from 'http';
import { createTestApp, TestApp } from '../utils/app-harness';

/**
 * Exercises `JwtAuthGuard` + `UsersController` against the faked Supabase
 * client. Registration/login themselves are NOT this server's job under this
 * variant (the client calls Supabase directly for those — see
 * src/auth/auth.module.ts) — so tests here seed a "logged in" user directly
 * via `harness.supabase.addUser()` instead of hitting a register/login route
 * that doesn't exist.
 */
describe('users (e2e)', () => {
  let harness: TestApp;
  let server: Server;

  const token = 'fake-access-token';
  const user = { id: 'user-1', email: 'fan@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };

  beforeAll(async () => {
    harness = await createTestApp();
    server = harness.app.getHttpServer() as Server;
  });

  beforeEach(() => {
    harness.supabase.addUser(token, user);
  });

  afterEach(() => harness.resetDb());

  afterAll(() => harness.close());

  it('rejects a request with no bearer token', async () => {
    await request(server).get('/users/me').expect(401);
  });

  it('rejects a request with an unrecognized token', async () => {
    await request(server).get('/users/me').set('Authorization', 'Bearer not-a-real-token').expect(401);
  });

  it('returns the empty profile handle_new_user() would have seeded', async () => {
    const response = await request(server)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      id: user.id,
      email: user.email,
      username: '',
      displayName: '',
      emailVerified: true,
      role: 'particulier',
    });
  });

  it('updates the profile via PATCH /users/me', async () => {
    const response = await request(server)
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'whale_fan', displayName: 'Fan' })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({ username: 'whale_fan', displayName: 'Fan' }),
    );
  });

  it('rejects a username already taken by another user with 409', async () => {
    const otherToken = 'fake-access-token-2';
    harness.supabase.addUser(otherToken, { id: 'user-2', email: 'other@example.com', email_confirmed_at: null });

    await request(server)
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'whale_fan' })
      .expect(200);

    await request(server)
      .patch('/users/me')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ username: 'whale_fan' })
      .expect(409);
  });
});
