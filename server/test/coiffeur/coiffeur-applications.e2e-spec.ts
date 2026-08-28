import request from 'supertest';
import type { Server } from 'http';
import { createTestApp, TestApp } from '../utils/app-harness';

/**
 * Exercises the coiffeur onboarding endpoints end to end: submission (both
 * practice zones), the role promotion it triggers, the admin review queue's
 * `@Roles('admin')` gate, and the mandatory shop-profile completion step
 * (issue #7).
 */
describe('coiffeur applications (e2e)', () => {
  let harness: TestApp;
  let server: Server;

  const coiffeurToken = 'coiffeur-token';
  const coiffeur = { id: 'coiffeur-1', email: 'sofia@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };

  const adminToken = 'admin-token';
  const admin = { id: 'admin-1', email: 'admin@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };

  const salonBody = {
    firstName: 'Sofia',
    lastName: 'Benali',
    phone: '06 12 34 56 78',
    salonName: 'Studio W',
    practiceZone: 'salon',
    addressLine: '12 rue des Lilas',
    postalCode: '75011',
    city: 'Paris',
    invoiceDocumentPath: `${coiffeur.id}/invoice.pdf`,
    identityDocumentPath: `${coiffeur.id}/identity.pdf`,
    diplomaDocumentPath: `${coiffeur.id}/diploma.pdf`,
    kbisDocumentPath: `${coiffeur.id}/kbis.pdf`,
  };

  beforeAll(async () => {
    harness = await createTestApp();
    server = harness.app.getHttpServer() as Server;
  });

  beforeEach(() => {
    harness.supabase.addUser(coiffeurToken, coiffeur, 'particulier');
    harness.supabase.addUser(adminToken, admin, 'admin');
  });

  afterEach(() => harness.resetDb());

  afterAll(() => harness.close());

  it('rejects an unauthenticated submission', async () => {
    await request(server).post('/coiffeur/applications').send(salonBody).expect(401);
  });

  it('rejects a salon application without invoiceDocumentPath', async () => {
    await request(server)
      .post('/coiffeur/applications')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ ...salonBody, invoiceDocumentPath: undefined })
      .expect(400);
  });

  it('rejects a document path outside the caller’s own storage folder', async () => {
    await request(server)
      .post('/coiffeur/applications')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ ...salonBody, identityDocumentPath: 'someone-else/identity.pdf' })
      .expect(400);
  });

  it('submits a salon application and promotes the caller to coiffeur', async () => {
    const response = await request(server)
      .post('/coiffeur/applications')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send(salonBody)
      .expect(201);

    expect(response.body).toMatchObject({
      status: 'pending',
      practiceZone: 'salon',
      salonName: 'Studio W',
      shopProfileComplete: false,
    });

    const me = await request(server)
      .get('/users/me')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .expect(200);
    expect(me.body).toMatchObject({ role: 'coiffeur' });
  });

  it('submits a domicile application without address fields', async () => {
    const domicileBody = {
      ...salonBody,
      practiceZone: 'domicile',
      addressLine: undefined,
      postalCode: undefined,
      city: undefined,
      invoiceDocumentPath: undefined,
      travelRadiusKm: 15,
    };

    const response = await request(server)
      .post('/coiffeur/applications')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send(domicileBody)
      .expect(201);

    expect(response.body).toMatchObject({ practiceZone: 'domicile', travelRadiusKm: 15 });
  });

  it('blocks a non-admin from the review queue', async () => {
    await request(server)
      .get('/admin/coiffeur-applications')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .expect(403);
  });

  it('lets an admin list, reject with a message, and the coiffeur resubmit', async () => {
    const submitted = await request(server)
      .post('/coiffeur/applications')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send(salonBody)
      .expect(201);

    const pending = await request(server)
      .get('/admin/coiffeur-applications?status=pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(pending.body).toEqual([expect.objectContaining({ id: submitted.body.id })]);

    await request(server)
      .patch(`/admin/coiffeur-applications/${submitted.body.id}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'rejected', message: 'Diplôme illisible' })
      .expect(200);

    const afterRejection = await request(server)
      .get('/coiffeur/applications/me')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .expect(200);
    expect(afterRejection.body).toMatchObject({ status: 'rejected', reviewMessage: 'Diplôme illisible' });

    const resubmitted = await request(server)
      .post('/coiffeur/applications')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send({ ...salonBody, salonName: 'Studio W 2' })
      .expect(201);
    expect(resubmitted.body).toMatchObject({
      id: submitted.body.id,
      status: 'pending',
      reviewMessage: null,
      salonName: 'Studio W 2',
    });
  });

  it('requires validation before the shop profile can be completed', async () => {
    await request(server)
      .post('/coiffeur/applications')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send(salonBody)
      .expect(201);

    await request(server)
      .patch('/coiffeur/applications/me/shop-profile')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .expect(400);
  });

  it('completes the mandatory shop-profile step once validated (issue #7)', async () => {
    const submitted = await request(server)
      .post('/coiffeur/applications')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .send(salonBody)
      .expect(201);

    await request(server)
      .patch(`/admin/coiffeur-applications/${submitted.body.id}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'validated' })
      .expect(200);

    const completed = await request(server)
      .patch('/coiffeur/applications/me/shop-profile')
      .set('Authorization', `Bearer ${coiffeurToken}`)
      .expect(200);
    expect(completed.body).toMatchObject({ shopProfileComplete: true });
  });
});
