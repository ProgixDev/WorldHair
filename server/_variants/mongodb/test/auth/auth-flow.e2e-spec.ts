import request from 'supertest';
import type { Server } from 'http';
import { createTestApp, TestApp } from '../utils/app-harness';

/**
 * The golden path this whole auth module exists for: register, verify email,
 * log in, hit a protected route, rotate the refresh token, then log out and
 * confirm the old refresh token is dead. Runs against a real in-memory Mongo
 * (mongodb-memory-server), not a mock, through the exact middleware stack
 * main.ts uses (see createTestApp -> configureApp).
 */
describe('auth flow (e2e)', () => {
  let harness: TestApp;
  let server: Server;

  const payload = { email: 'fan@example.com', password: 'sup3r-secret-pw' };

  beforeAll(async () => {
    harness = await createTestApp();
    server = harness.app.getHttpServer() as Server;
  });

  afterEach(() => harness.resetDb());

  afterAll(() => harness.close());

  it('registers, verifies, logs in, accesses a protected route, refreshes, and logs out', async () => {
    // 1. Register — creates the account and returns a usable token pair.
    const registerRes = await request(server).post('/auth/register').send(payload).expect(201);

    expect(registerRes.body).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      user: expect.objectContaining({
        id: expect.any(String),
        email: payload.email,
        emailVerified: false,
      }),
    });
    expect(JSON.stringify(registerRes.body)).not.toContain('passwordHash');

    // 2. A protected route works immediately with the token from registration.
    await request(server)
      .get('/users/me')
      .set('Authorization', `Bearer ${registerRes.body.accessToken}`)
      .expect(200);

    // No token at all: rejected.
    await request(server).get('/users/me').expect(401);

    // 3. Verify the emailed code, which also returns a fresh token pair.
    const code = harness.mail.lastToken('verification');
    const verifyRes = await request(server)
      .post('/auth/verify-email')
      .send({ token: code })
      .expect(200);

    expect(verifyRes.body.user.emailVerified).toBe(true);

    // 4. Log in independently with the original credentials.
    const loginRes = await request(server).post('/auth/login').send(payload).expect(200);

    // 5. Refresh rotates to a brand new pair; the old refresh token dies.
    const refreshRes = await request(server)
      .post('/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken })
      .expect(200);

    expect(refreshRes.body.refreshToken).not.toBe(loginRes.body.refreshToken);

    await request(server)
      .post('/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken })
      .expect(401);

    // 6. Log out revokes the current refresh token too.
    await request(server)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${refreshRes.body.accessToken}`)
      .send({ refreshToken: refreshRes.body.refreshToken })
      .expect(204);

    await request(server)
      .post('/auth/refresh')
      .send({ refreshToken: refreshRes.body.refreshToken })
      .expect(401);
  });

  it('rejects a duplicate registration with 409', async () => {
    await request(server).post('/auth/register').send(payload).expect(201);

    const response = await request(server).post('/auth/register').send(payload).expect(409);

    expect(response.body.message).toMatch(/already exists/i);
  });

  it('rejects login with a wrong password', async () => {
    await request(server).post('/auth/register').send(payload).expect(201);

    await request(server)
      .post('/auth/login')
      .send({ ...payload, password: 'wrong-password' })
      .expect(401);
  });

  it('sets a new password for the current session via POST /auth/password', async () => {
    const registerRes = await request(server).post('/auth/register').send(payload).expect(201);

    await request(server)
      .post('/auth/password')
      .set('Authorization', `Bearer ${registerRes.body.accessToken}`)
      .send({ currentPassword: payload.password, password: 'a-new-sup3r-secret-pw' })
      .expect(204);

    await request(server).post('/auth/login').send(payload).expect(401);
    await request(server)
      .post('/auth/login')
      .send({ email: payload.email, password: 'a-new-sup3r-secret-pw' })
      .expect(200);
  });

  it('updates the profile via PATCH /users/me', async () => {
    const registerRes = await request(server).post('/auth/register').send(payload).expect(201);

    const response = await request(server)
      .patch('/users/me')
      .set('Authorization', `Bearer ${registerRes.body.accessToken}`)
      .send({ username: 'whale_fan', displayName: 'Fan' })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({ username: 'whale_fan', displayName: 'Fan' }),
    );
  });
});
