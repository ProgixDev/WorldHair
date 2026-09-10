import request from 'supertest';
import type { Server } from 'http';
import { randomUUID } from 'crypto';
import { Webhook } from 'standardwebhooks';
import { createTestApp, TestApp } from '../utils/app-harness';

/**
 * Hits the real HTTP route (unlike email-hook.service.spec.ts, which drives
 * the service directly) — this is what actually proves req.rawBody survives
 * Nest's body-parsing pipeline intact enough for the signature to verify,
 * which is the one thing a unit test can't check.
 */

// Must match test-env.ts's SEND_EMAIL_HOOK_SECRET.
const SECRET = 'v1,whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';

function signedRequest(payload: object, secret = SECRET): { body: string; headers: Record<string, string> } {
  const body = JSON.stringify(payload);
  const key = secret.replace(/^v1,/, '');
  const wh = new Webhook(key);
  const msgId = `msg_${randomUUID()}`;
  const timestamp = new Date();

  return {
    body,
    headers: {
      'webhook-id': msgId,
      'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
      'webhook-signature': wh.sign(msgId, timestamp, body),
    },
  };
}

function signupPayload(email: string, token: string) {
  return {
    user: { id: 'user-1', email },
    email_data: {
      token,
      token_hash: 'hash',
      redirect_to: 'https://worldhair.app/',
      email_action_type: 'signup',
      site_url: 'https://worldhair.app',
      token_new: '',
      token_hash_new: '',
    },
  };
}

describe('auth/email-hook (e2e)', () => {
  let harness: TestApp;
  let server: Server;

  beforeAll(async () => {
    harness = await createTestApp();
    server = harness.app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await harness.close();
  });

  it('accepts a validly-signed Supabase Send Email Hook payload', async () => {
    const { body, headers } = signedRequest(signupPayload('sofia@example.com', '112233'));

    await request(server)
      .post('/auth/email-hook')
      .set('Content-Type', 'application/json')
      .set(headers)
      .send(body)
      .expect(201, { received: true });
  });

  it('rejects an unsigned request', async () => {
    await request(server)
      .post('/auth/email-hook')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(signupPayload('sofia@example.com', '112233')))
      .expect(401);
  });

  it('rejects a payload whose signature does not match its body', async () => {
    const { headers } = signedRequest(signupPayload('sofia@example.com', '112233'));
    const swappedBody = JSON.stringify(signupPayload('attacker@evil.com', '999999'));

    await request(server)
      .post('/auth/email-hook')
      .set('Content-Type', 'application/json')
      .set(headers)
      .send(swappedBody)
      .expect(401);
  });

  it('never requires a bearer token — this caller is Supabase, not an app user', async () => {
    const { body, headers } = signedRequest(signupPayload('sofia@example.com', '112233'));

    // No Authorization header at all, and it still succeeds — proves
    // @Public() is actually wired through the global JwtAuthGuard.
    await request(server)
      .post('/auth/email-hook')
      .set('Content-Type', 'application/json')
      .set(headers)
      .send(body)
      .expect(201);
  });
});
