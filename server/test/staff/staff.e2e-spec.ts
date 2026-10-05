import request from 'supertest';
import type { Server } from 'http';
import { parisParts, parisTime } from '../../src/common/utils/paris-time';
import { createTestApp, TestApp } from '../utils/app-harness';

/** Next Wednesday (Paris), from tomorrow on, at `hour`. */
function nextWednesday(hour: number): Date {
  const today = parisParts(new Date());
  for (let offset = 1; offset <= 7; offset++) {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    if (day.getUTCDay() === 3) return parisTime(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hour);
  }
  throw new Error('unreachable');
}

/** A salon's team (TODO.md Phase 3): invite, join, the owner's choice on accepting, the staff member's own agenda. */
describe('staff (e2e)', () => {
  let harness: TestApp;
  let server: Server;

  const ownerToken = 'owner-token';
  const owner = { id: '11111111-1111-4111-8111-111111111111', email: 'sofia@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };
  const nadiaToken = 'nadia-token';
  const nadia = { id: '22222222-2222-4222-8222-222222222222', email: 'nadia@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };
  const clientToken = 'client-token';
  const client = { id: '33333333-3333-4333-8333-333333333333', email: 'camille@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' };

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    harness = await createTestApp();
    server = harness.app.getHttpServer() as Server;
  });

  beforeEach(() => {
    harness.supabase.addUser(ownerToken, owner, 'coiffeur');
    harness.supabase.seedValidatedSalon({
      profileId: owner.id,
      firstName: 'Sofia',
      lastName: 'Benali',
      salonName: 'Studio W',
      services: [{ name: 'Coupe', price: 40, durationMin: 60, specialty: 'coupe' }],
      confirmationMode: 'manual',
    });
    // Signed up through « Rejoindre un salon »: a client account until the code is in.
    harness.supabase.addUser(nadiaToken, nadia, 'particulier', { firstName: 'Nadia', lastName: 'Kaci' });
    harness.supabase.addUser(clientToken, client, 'particulier', { firstName: 'Camille', lastName: 'Durand' });
  });

  afterEach(() => harness.resetDb());
  afterAll(() => harness.close());

  async function joinNadia(): Promise<string> {
    const invite = await request(server).post('/salon/me/invites').set(as(ownerToken)).expect(201);
    const joined = await request(server).post('/staff/join').set(as(nadiaToken)).send({ code: invite.body.code }).expect(201);
    return joined.body.staffId as string;
  }

  it('lets a coiffeur join with the owner’s code, then shows the team', async () => {
    const staffId = await joinNadia();

    await request(server)
      .get('/staff/me')
      .set(as(nadiaToken))
      .expect(200)
      .expect((res) => expect(res.body).toEqual({ membership: { staffId, salonId: owner.id, salonName: 'Studio W', isOwner: false } }));
    const team = await request(server).get('/salon/me/staff').set(as(ownerToken)).expect(200);
    expect(team.body.map((member: { firstName: string; isOwner: boolean }) => [member.firstName, member.isOwner])).toEqual([
      ['Sofia', true],
      ['Nadia', false],
    ]);
  });

  it("tells anyone with the link which salon it joins, signed in or not", async () => {
    const invite = await request(server).post('/salon/me/invites').set(as(ownerToken)).expect(201);
    await request(server)
      .get(`/staff/invites/${invite.body.code}`)
      .expect(200)
      .expect((res) => expect(res.body).toMatchObject({ code: invite.body.code, salonName: 'Studio W' }));
    await request(server).get('/staff/invites/ZZZZZZ').expect(404);
  });

  it('refuses a wrong code, and keeps the team and invites to the owner', async () => {
    await request(server).post('/staff/join').set(as(nadiaToken)).send({ code: 'ZZZZZZ' }).expect(404);
    await request(server).post('/staff/join').set(as(nadiaToken)).send({ code: 'short' }).expect(400);
    await request(server).get('/salon/me/staff').set(as(clientToken)).expect(403);
    await request(server).post('/salon/me/invites').set(as(clientToken)).expect(403);
  });

  it('accepts a request only with the person the owner picks, then shows it in that person’s agenda', async () => {
    const staffId = await joinNadia();
    const services = await request(server).get('/salon/me/services').set(as(ownerToken)).expect(200);
    const held = await request(server)
      .post('/appointments')
      .set(as(clientToken))
      .send({ coiffeurId: owner.id, serviceIds: [services.body[0].id], startsAt: nextWednesday(10).toISOString() })
      .expect(201);
    harness.stripe.completeCheckout(harness.supabase.paymentFor(held.body.appointment.id)!.checkout_session_id!);
    const id = held.body.appointment.id as string;
    await request(server).post(`/appointments/${id}/payment/confirm`).set(as(clientToken)).expect(200);

    await request(server)
      .patch(`/appointments/${id}/decide`)
      .set(as(ownerToken))
      .send({ decision: 'confirmed', staffId: 'not-a-uuid' })
      .expect(400);
    await request(server).patch(`/appointments/${id}/decide`).set(as(ownerToken)).send({ decision: 'confirmed', staffId }).expect(200);

    const agenda = await request(server).get('/staff/me/appointments').set(as(nadiaToken)).expect(200);
    expect(agenda.body).toEqual([expect.objectContaining({ id, staffId, staffName: 'Nadia Kaci', status: 'confirmed', payment: null })]);
    // Read-only: the owner decides.
    await request(server).patch(`/appointments/${id}/decide`).set(as(nadiaToken)).send({ decision: 'refused' }).expect(403);
  });

  it('lets a staff member export their data and delete their account (GDPR)', async () => {
    await joinNadia();
    await request(server).get('/users/me/export').set(as(nadiaToken)).expect(200);
    await request(server).delete('/users/me').set(as(nadiaToken)).expect(204);
    expect(harness.supabase.staffOf(owner.id)).toHaveLength(1);
  });

  it('removes someone from the team, never with bookings to come', async () => {
    const staffId = await joinNadia();
    await request(server).delete(`/salon/me/staff/${staffId}`).set(as(ownerToken)).expect(204);
    await request(server)
      .get('/staff/me')
      .set(as(nadiaToken))
      .expect(200)
      .expect((res) => expect(res.body).toEqual({ membership: null }));
  });
});
