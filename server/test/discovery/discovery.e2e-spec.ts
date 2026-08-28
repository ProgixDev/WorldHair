import request from 'supertest';
import type { Server } from 'http';
import { createTestApp, TestApp } from '../utils/app-harness';

/** Exercises the public salon search/detail surface (TODO.md "Recherche & géolocalisation"). */
describe('discovery (e2e)', () => {
  let harness: TestApp;
  let server: Server;

  const particulierToken = 'particulier-token';
  const particulier = { id: 'particulier-1', email: 'fan@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };

  beforeAll(async () => {
    harness = await createTestApp();
    server = harness.app.getHttpServer() as Server;
  });

  beforeEach(() => {
    harness.supabase.addUser(particulierToken, particulier, 'particulier');
  });

  afterEach(() => harness.resetDb());

  afterAll(() => harness.close());

  it('rejects an unauthenticated request', async () => {
    await request(server).get('/salons').expect(401);
  });

  it('lists only validated, shop-complete salons', async () => {
    harness.supabase.seedValidatedSalon({
      profileId: 'salon-1',
      firstName: 'Sofia',
      lastName: 'Benali',
      salonName: 'Studio W',
      city: 'Paris',
      specialties: ['coupe'],
    });
    harness.supabase.seedApplication({ profileId: 'pending-1', firstName: 'A', lastName: 'B', status: 'pending' });

    const res = await request(server).get('/salons').set('Authorization', `Bearer ${particulierToken}`).expect(200);
    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual(['salon-1']);
    expect(res.body.total).toBe(1);
  });

  it('filters by specialty and geo radius', async () => {
    harness.supabase.seedValidatedSalon({
      profileId: 'paris-salon',
      firstName: 'Sofia',
      lastName: 'Benali',
      salonName: 'Studio Paris',
      latitude: 48.8606,
      longitude: 2.3376,
      specialties: ['coupe', 'coloration'],
    });
    harness.supabase.seedValidatedSalon({
      profileId: 'lyon-salon',
      firstName: 'Awa',
      lastName: 'Diallo',
      salonName: 'Studio Lyon',
      latitude: 45.764,
      longitude: 4.8357,
      specialties: ['afro'],
    });

    const bySpecialty = await request(server)
      .get('/salons')
      .query({ specialty: 'afro' })
      .set('Authorization', `Bearer ${particulierToken}`)
      .expect(200);
    expect(bySpecialty.body.items.map((item: { id: string }) => item.id)).toEqual(['lyon-salon']);

    const nearParis = await request(server)
      .get('/salons')
      .query({ lat: 48.8606, lng: 2.3376, radiusKm: 50 })
      .set('Authorization', `Bearer ${particulierToken}`)
      .expect(200);
    expect(nearParis.body.items.map((item: { id: string }) => item.id)).toEqual(['paris-salon']);
  });

  it('rejects an unknown specialty', async () => {
    await request(server)
      .get('/salons')
      .query({ specialty: 'not-a-real-specialty' })
      .set('Authorization', `Bearer ${particulierToken}`)
      .expect(400);
  });

  it('lists distinct cities among visible salons', async () => {
    harness.supabase.seedValidatedSalon({ profileId: 'p1', firstName: 'A', lastName: 'B', salonName: 'S1', city: 'Lyon' });
    harness.supabase.seedValidatedSalon({ profileId: 'p2', firstName: 'C', lastName: 'D', salonName: 'S2', city: 'Paris' });

    const res = await request(server).get('/salons/cities').set('Authorization', `Bearer ${particulierToken}`).expect(200);
    expect(res.body).toEqual(['Lyon', 'Paris']);
  });

  it('returns full detail for a validated salon, 404s otherwise', async () => {
    harness.supabase.seedValidatedSalon({
      profileId: '11111111-1111-1111-1111-111111111111',
      firstName: 'Sofia',
      lastName: 'Benali',
      salonName: 'Studio W',
      services: [{ name: 'Coupe', price: 40, durationMin: 30, specialty: 'coupe' }],
    });

    const detail = await request(server)
      .get('/salons/11111111-1111-1111-1111-111111111111')
      .set('Authorization', `Bearer ${particulierToken}`)
      .expect(200);
    expect(detail.body).toMatchObject({ salonName: 'Studio W', stylist: 'Sofia Benali' });
    expect(detail.body.services).toHaveLength(1);

    await request(server)
      .get('/salons/22222222-2222-2222-2222-222222222222')
      .set('Authorization', `Bearer ${particulierToken}`)
      .expect(404);
  });

  it('400s a malformed id', async () => {
    await request(server)
      .get('/salons/not-a-uuid')
      .set('Authorization', `Bearer ${particulierToken}`)
      .expect(400);
  });
});
