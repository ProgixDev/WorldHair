import request from 'supertest';
import type { Server } from 'http';
import { createTestApp, TestApp } from './utils/app-harness';

describe('health (e2e)', () => {
  let harness: TestApp;
  let server: Server;

  beforeAll(async () => {
    harness = await createTestApp();
    server = harness.app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await harness.close();
  });

  it('reports liveness', async () => {
    await request(server).get('/health').expect(200, { status: 'ok' });
  });

  it('reports readiness against the (faked) Supabase client', async () => {
    const response = await request(server).get('/health/ready').expect(200);

    expect(response.body).toEqual({ status: 'ok', details: { supabase: { status: 'up' } } });
  });
});
