import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { SupabaseService } from '../database/supabase.service';
import { AvailabilityDay } from '../salon/salon.service';
import { StaffService } from './staff.service';

const OWNER = 'owner-1';
const NADIA = 'nadia-1';
const CLIENT = 'client-1';

const AFTERNOONS: AvailabilityDay[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  isOpen: weekday === 3,
  opensMinute: 14 * 60,
  closesMinute: 18 * 60,
  breakStartMinute: null,
  breakEndMinute: null,
}));

describe('StaffService', () => {
  let supabase: FakeSupabaseService;
  let events: EventEmitter2;
  let staff: StaffService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    events = new EventEmitter2();
    staff = new StaffService(supabase as unknown as SupabaseService, events);
    supabase.seedValidatedSalon({ profileId: OWNER, firstName: 'Sofia', lastName: 'Benali', salonName: 'Studio W' });
    supabase.addUser('nadia-token', { id: NADIA, email: 'nadia@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' }, 'staff', {
      firstName: 'Nadia',
      lastName: 'Kaci',
    });
    supabase.addUser('client-token', { id: CLIENT, email: 'client@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' });
  });

  async function joinNadia(): Promise<string> {
    const { code } = await staff.createInvite(OWNER);
    return (await staff.join(NADIA, code)).staffId;
  }

  describe('team', () => {
    it("makes a salon's owner its first member, on the salon's hours", async () => {
      const team = await staff.team(OWNER);

      expect(team).toEqual([
        expect.objectContaining({ profileId: OWNER, isOwner: true, takesBookings: true, availability: null, firstName: 'Sofia' }),
      ]);
      await staff.team(OWNER);
      expect(supabase.staffOf(OWNER)).toHaveLength(1);
    });
  });

  describe('invites and joining', () => {
    it('gives a 6-character code valid 7 days, listed until used', async () => {
      const invite = await staff.createInvite(OWNER);

      expect(invite.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      expect(new Date(invite.expiresAt).getTime() - Date.now()).toBeGreaterThan(6.9 * 86_400_000);
      await expect(staff.listInvites(OWNER)).resolves.toEqual([invite]);
    });

    it('lets a coiffeur join with a code: they become a member, the code is spent, the owner is told', async () => {
      const joined = jest.fn();
      events.on('staff.joined', joined);
      const { code } = await staff.createInvite(OWNER);

      const membership = await staff.join(NADIA, ` ${code.toLowerCase()} `);

      expect(membership).toMatchObject({ salonId: OWNER, salonName: 'Studio W', isOwner: false });
      expect((await staff.team(OWNER)).map((member) => member.firstName)).toEqual(['Sofia', 'Nadia']);
      expect(supabase.profileFor(NADIA)?.role).toBe('staff');
      await expect(staff.listInvites(OWNER)).resolves.toEqual([]);
      expect(joined).toHaveBeenCalledWith({ salonId: OWNER, profileId: NADIA, staffId: membership.staffId });
      await expect(staff.membershipOf(NADIA)).resolves.toMatchObject({ salonId: OWNER, staffId: membership.staffId });
    });

    it('turns a client account into a staff one', async () => {
      const { code } = await staff.createInvite(OWNER);
      await staff.join(CLIENT, code);
      expect(supabase.profileFor(CLIENT)?.role).toBe('staff');
    });

    it('refuses a code already used, expired, revoked or unknown', async () => {
      const { code } = await staff.createInvite(OWNER);
      await staff.join(NADIA, code);
      await expect(staff.join(CLIENT, code)).rejects.toThrow(NotFoundException);

      const revoked = await staff.createInvite(OWNER);
      await staff.revokeInvite(OWNER, revoked.code);
      await expect(staff.join(CLIENT, revoked.code)).rejects.toThrow(NotFoundException);

      const expired = await staff.createInvite(OWNER);
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 8 * 86_400_000);
      await expect(staff.join(CLIENT, expired.code)).rejects.toThrow(NotFoundException);
      jest.restoreAllMocks();

      await expect(staff.join(CLIENT, 'ZZZZZZ')).rejects.toThrow(NotFoundException);
    });

    it("gives the code back when joining can't finish, and leaves nobody half-joined", async () => {
      const { code } = await staff.createInvite(OWNER);
      const from = supabase.client.from.bind(supabase.client);
      jest.spyOn(supabase.client, 'from').mockImplementation(((table: string) => {
        if (table !== 'profiles') return from(table);
        const real = from(table);
        return {
          ...real,
          update: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'down' } }) }) }) }),
        };
      }) as typeof supabase.client.from);

      await expect(staff.join(CLIENT, code)).rejects.toThrow();
      jest.restoreAllMocks();

      expect(supabase.inviteFor(code)).toMatchObject({ used_at: null, used_by: null });
      await expect(staff.membershipOf(CLIENT)).resolves.toBeNull();
      await staff.join(CLIENT, code);
      await expect(staff.membershipOf(CLIENT)).resolves.toMatchObject({ salonId: OWNER });
    });

    it('makes codes for a validated salon only', async () => {
      supabase.addUser('pending-token', { id: 'pending-1', email: 'p@example.com', email_confirmed_at: null }, 'coiffeur');
      await expect(staff.createInvite('pending-1')).rejects.toThrow(ForbiddenException);
    });

    it("refuses someone already in a salon, and a salon's owner", async () => {
      await joinNadia();
      const { code } = await staff.createInvite(OWNER);

      await expect(staff.join(NADIA, code)).rejects.toThrow(ConflictException);
      await expect(staff.join(OWNER, code)).rejects.toThrow(ConflictException);
    });
  });

  describe('managing the team', () => {
    it("sets a person's own week, and gives them back the salon's hours", async () => {
      const nadia = await joinNadia();

      await staff.replaceHours(OWNER, nadia, AFTERNOONS);
      expect((await staff.member(OWNER, nadia)).availability).toEqual(AFTERNOONS);

      await staff.replaceHours(OWNER, nadia, null);
      expect((await staff.member(OWNER, nadia)).availability).toBeNull();
    });

    it('refuses a week that is not seven distinct days, keeping the one saved', async () => {
      const nadia = await joinNadia();
      await staff.replaceHours(OWNER, nadia, AFTERNOONS);

      await expect(staff.replaceHours(OWNER, nadia, [...AFTERNOONS.slice(0, 6), AFTERNOONS[0]])).rejects.toThrow(BadRequestException);
      await expect(staff.replaceHours(OWNER, nadia, [])).rejects.toThrow(BadRequestException);
      expect((await staff.member(OWNER, nadia)).availability).toEqual(AFTERNOONS);
    });

    it("turns a person's bookings off and on", async () => {
      const nadia = await joinNadia();
      await staff.setTakesBookings(OWNER, nadia, false);
      expect((await staff.member(OWNER, nadia)).takesBookings).toBe(false);
    });

    it("doesn't touch another salon's members", async () => {
      const nadia = await joinNadia();
      await expect(staff.member('another-salon', nadia)).rejects.toThrow(NotFoundException);
      await expect(staff.setTakesBookings('another-salon', nadia, false)).rejects.toThrow(NotFoundException);
    });

    it('removes a person with no booking to come, never the owner', async () => {
      const nadia = await joinNadia();
      const [owner] = await staff.team(OWNER);

      await expect(staff.remove(OWNER, owner.id)).rejects.toThrow(BadRequestException);
      await staff.remove(OWNER, nadia);
      expect(supabase.staffOf(OWNER)).toHaveLength(1);
      await expect(staff.membershipOf(NADIA)).resolves.toBeNull();
    });

    it('refuses to remove, or let leave, someone with bookings to come: the owner reassigns them first', async () => {
      const nadia = await joinNadia();
      supabase.seedAppointment({
        particulierId: CLIENT,
        coiffeurId: OWNER,
        staffId: nadia,
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      });

      await expect(staff.remove(OWNER, nadia)).rejects.toThrow(ConflictException);
      await expect(staff.leave(NADIA)).rejects.toThrow(ConflictException);
    });

    it('counts a booking in progress as one to come', async () => {
      const nadia = await joinNadia();
      supabase.seedAppointment({
        particulierId: CLIENT,
        coiffeurId: OWNER,
        staffId: nadia,
        startsAt: new Date(Date.now() - 10 * 60_000).toISOString(),
        durationMin: 60,
      });
      await expect(staff.remove(OWNER, nadia)).rejects.toThrow(ConflictException);
    });

    it('lets a member leave; the owner can only close his salon', async () => {
      await joinNadia();
      await staff.leave(NADIA);
      await expect(staff.membershipOf(NADIA)).resolves.toBeNull();
      await staff.team(OWNER);
      await expect(staff.leave(OWNER)).rejects.toThrow(BadRequestException);
    });
  });
});
