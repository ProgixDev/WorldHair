import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { SupabaseService } from '../database/supabase.service';
import { StaffService } from '../staff/staff.service';
import { PresenceService } from './presence.service';

const SALON = 'salon-1';
const NADIA = 'nadia-1';
const CAMILLE = 'camille-1';
const AWA = 'awa-1';

const HOUR = 3_600_000;
const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

/** The end-of-service code (« Afficher le code de fin », TODO.md): the salon shows it, the client scans it, the booking reads as done. */
describe('PresenceService', () => {
  let supabase: FakeSupabaseService;
  let events: EventEmitter2;
  let presence: PresenceService;
  let nadiaStaff: string;

  /** A confirmed booking that started 40 minutes ago and lasts an hour. */
  function booking(overrides: Partial<Parameters<FakeSupabaseService['seedAppointment']>[0]> = {}): string {
    return supabase.seedAppointment({
      particulierId: CAMILLE,
      coiffeurId: SALON,
      startsAt: minutesFromNow(-40),
      durationMin: 60,
      status: 'confirmed',
      ...overrides,
    });
  }

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    events = new EventEmitter2();
    const staff = new StaffService(supabase as unknown as SupabaseService, events);
    presence = new PresenceService(supabase as unknown as SupabaseService, staff, events);
    supabase.seedValidatedSalon({ profileId: SALON, firstName: 'Sofia', lastName: 'Benali', salonName: 'Studio W' });
    supabase.addUser('nadia', { id: NADIA, email: 'nadia@example.com', email_confirmed_at: null }, 'staff');
    nadiaStaff = supabase.seedStaff({ salonId: SALON, profileId: NADIA });
    supabase.addUser('camille', { id: CAMILLE, email: 'camille@example.com', email_confirmed_at: null }, 'particulier', { firstName: 'Camille', lastName: 'Durand' });
    supabase.addUser('awa', { id: AWA, email: 'awa@example.com', email_confirmed_at: null }, 'particulier');
  });

  describe('showing the code', () => {
    it('gives the salon a code for a booking in progress, valid a few minutes', async () => {
      const { code, expiresAt } = await presence.issue(SALON, booking());

      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);
      const left = new Date(expiresAt).getTime() - Date.now();
      expect(left).toBeGreaterThan(4 * 60_000);
      expect(left).toBeLessThanOrEqual(5 * 60_000);
    });

    it("also gives it to the staff member whose booking it is, not to a colleague's or a stranger's", async () => {
      const mine = booking({ staffId: nadiaStaff });
      const owners = booking({ startsAt: minutesFromNow(-30) });

      await expect(presence.issue(NADIA, mine)).resolves.toMatchObject({ code: expect.any(String) });
      await expect(presence.issue(NADIA, owners)).rejects.toThrow(ForbiddenException);
      await expect(presence.issue(AWA, mine)).rejects.toThrow(ForbiddenException);
    });

    it('replaces the previous code: only the latest one works', async () => {
      const id = booking();
      const first = await presence.issue(SALON, id);
      const second = await presence.issue(SALON, id);

      expect(second.code).not.toBe(first.code);
      await expect(presence.confirm(CAMILLE, first.code)).rejects.toThrow(NotFoundException);
      await expect(presence.confirm(CAMILLE, second.code)).resolves.toMatchObject({ appointmentId: id });
    });

    it("refuses before it starts, long after it ended, when it isn't accepted, or marked absent", async () => {
      await expect(presence.issue(SALON, booking({ startsAt: minutesFromNow(30) }))).rejects.toThrow(BadRequestException);
      await expect(presence.issue(SALON, booking({ startsAt: new Date(Date.now() - 14 * HOUR).toISOString() }))).rejects.toThrow(BadRequestException);
      await expect(presence.issue(SALON, booking({ status: 'pending' }))).rejects.toThrow(BadRequestException);
      await expect(presence.issue(SALON, booking({ attendance: 'no_show' }))).rejects.toThrow(BadRequestException);
    });

    it('says when the client already confirmed, instead of making a new code', async () => {
      const id = booking();
      const { code } = await presence.issue(SALON, id);
      await presence.confirm(CAMILLE, code);

      await expect(presence.issue(SALON, id)).rejects.toThrow(ConflictException);
    });
  });

  describe('scanning it', () => {
    it("marks the booking done and confirmed by the client, and tells the salon", async () => {
      const heard = jest.fn();
      events.on('appointment.presence_confirmed', heard);
      const id = booking({ staffId: nadiaStaff, serviceName: 'Coupe & brushing' });
      const { code } = await presence.issue(SALON, id);

      const confirmed = await presence.confirm(CAMILLE, ` ${code.toLowerCase()} `);

      expect(confirmed).toMatchObject({ appointmentId: id, salonName: 'Studio W', serviceName: 'Coupe & brushing' });
      expect(supabase.appointmentFor(id)).toMatchObject({ attendance: 'attended', confirmed_by_client_at: expect.any(String) });
      expect(heard).toHaveBeenCalledWith(
        expect.objectContaining({ appointmentId: id, coiffeurId: SALON, staffId: nadiaStaff, serviceName: 'Coupe & brushing' }),
      );
      await expect(presence.status(SALON, id)).resolves.toEqual({ confirmedByClientAt: expect.any(String) });
    });

    it("only works for the booking's own client", async () => {
      const id = booking();
      const { code } = await presence.issue(SALON, id);

      await expect(presence.confirm(AWA, code)).rejects.toThrow(ForbiddenException);
      expect(supabase.appointmentFor(id)?.confirmed_by_client_at).toBeNull();
    });

    it('refuses a code that is unknown or expired', async () => {
      const { code } = await presence.issue(SALON, booking());
      await expect(presence.confirm(CAMILLE, 'ZZZZZZZZZZZZ')).rejects.toThrow(NotFoundException);

      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60_000);
      await expect(presence.confirm(CAMILLE, code)).rejects.toThrow(NotFoundException);
      jest.restoreAllMocks();
    });

    it('answers a second scan with the same confirmation, without a second notification', async () => {
      const heard = jest.fn();
      events.on('appointment.presence_confirmed', heard);
      const id = booking();
      const { code } = await presence.issue(SALON, id);

      const first = await presence.confirm(CAMILLE, code);
      const again = await presence.confirm(CAMILLE, code);

      expect(again).toEqual(first);
      expect(heard).toHaveBeenCalledTimes(1);
    });

    it('does not confirm a booking cancelled meanwhile', async () => {
      const id = booking();
      const { code } = await presence.issue(SALON, id);
      supabase.setAppointmentStatus(id, 'cancelled');

      await expect(presence.confirm(CAMILLE, code)).rejects.toThrow(ConflictException);
    });
  });

  describe('status', () => {
    it("is for the salon (or the person doing it) only, and empty until the client scans", async () => {
      const id = booking({ staffId: nadiaStaff });
      await expect(presence.status(SALON, id)).resolves.toEqual({ confirmedByClientAt: null });
      await expect(presence.status(NADIA, id)).resolves.toEqual({ confirmedByClientAt: null });
      await expect(presence.status(CAMILLE, id)).rejects.toThrow(ForbiddenException);
    });
  });
});
