import { parisTime } from '../common/utils/paris-time';
import { AvailabilityDay } from '../salon/salon.service';
import { BookingRules, pickPerson, PersonRules, refusalFor, slotsForDay, slotsForTeam, teamRefusal } from './booking-rules';

/** Mon-Sat 9-19 with a 13-14 lunch break, Sunday closed — SalonService's default week. */
const WEEK: AvailabilityDay[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  isOpen: weekday !== 0,
  opensMinute: 9 * 60,
  closesMinute: 19 * 60,
  breakStartMinute: weekday === 0 ? null : 13 * 60,
  breakEndMinute: weekday === 0 ? null : 14 * 60,
}));

// Wednesday 30 September 2026 (Paris), and the Monday before it.
const WEDNESDAY = '2026-09-30';
const at = (hour: number, minute = 0) => parisTime(2026, 9, 30, hour, minute);
const MONDAY_MORNING = parisTime(2026, 9, 28, 8, 0);

function rules(overrides: Partial<BookingRules> = {}): BookingRules {
  return {
    availability: WEEK,
    closures: [],
    salonBookings: [],
    clientBookings: [],
    bookingNoticeMinutes: 0,
    now: MONDAY_MORNING,
    ...overrides,
  };
}

function freeLabels(day: ReturnType<typeof slotsForDay>): string[] {
  return day.slots.filter((slot) => slot.available).map((slot) => slot.label);
}

describe('booking rules', () => {
  describe('slotsForDay', () => {
    it('offers a start every 30 minutes from opening to the last one that still ends by closing time', () => {
      const day = slotsForDay(rules(), WEDNESDAY, 60);

      expect(day.closed).toBe(false);
      expect(day.slots[0]).toEqual({ startsAt: at(9).toISOString(), label: '09:00', available: true });
      expect(day.slots.at(-1)?.label).toBe('18:00');
      expect(day.slots).toHaveLength(19);
    });

    it('keeps the lunch break free for the whole length of the booking', () => {
      const day = slotsForDay(rules(), WEDNESDAY, 60);
      const unavailable = day.slots.filter((slot) => !slot.available).map((slot) => slot.label);

      expect(unavailable).toEqual(['12:30', '13:00', '13:30']);
    });

    it('blocks every start that would overlap a booking, not only its start time', () => {
      const day = slotsForDay(
        rules({ salonBookings: [{ startsAt: at(10).toISOString(), durationMin: 60 }] }),
        WEDNESDAY,
        60,
      );

      expect(freeLabels(day).slice(0, 3)).toEqual(['09:00', '11:00', '11:30']);
    });

    it("also blocks the times the client is already booked somewhere else", () => {
      const day = slotsForDay(
        rules({ clientBookings: [{ startsAt: at(9).toISOString(), durationMin: 30 }] }),
        WEDNESDAY,
        30,
      );

      expect(day.slots.find((slot) => slot.label === '09:00')?.available).toBe(false);
      expect(day.slots.find((slot) => slot.label === '09:30')?.available).toBe(true);
    });

    it("hides what's past or inside the salon's booking notice", () => {
      const day = slotsForDay(rules({ now: at(9, 10), bookingNoticeMinutes: 60 }), WEDNESDAY, 30);

      expect(freeLabels(day)[0]).toBe('10:30');
    });

    it('greys the hours of a partial closure', () => {
      const day = slotsForDay(
        rules({ closures: [{ startsAt: at(15).toISOString(), endsAt: at(19).toISOString() }] }),
        WEDNESDAY,
        60,
      );

      expect(freeLabels(day).at(-1)).toBe('14:00');
    });

    it('says the day is closed when a closure covers the whole opening', () => {
      const day = slotsForDay(
        rules({ closures: [{ startsAt: parisTime(2026, 9, 30).toISOString(), endsAt: parisTime(2026, 10, 1).toISOString() }] }),
        WEDNESDAY,
        30,
      );

      expect(day).toEqual({ date: WEDNESDAY, closed: true, slots: [] });
    });

    it('says a day the salon never opens is closed', () => {
      expect(slotsForDay(rules(), '2026-10-04', 30)).toEqual({ date: '2026-10-04', closed: true, slots: [] });
    });
  });

  describe('refusalFor', () => {
    it('accepts a free start, even off the half-hour grid', () => {
      expect(refusalFor(rules(), at(10, 15), 45)).toBeNull();
    });

    it('gives the reason a start is refused', () => {
      expect(refusalFor(rules({ now: at(12) }), at(11), 30)).toBe('past');
      expect(refusalFor(rules({ now: at(9), bookingNoticeMinutes: 60 }), at(9, 30), 30)).toBe('too_soon');
      expect(refusalFor(rules(), parisTime(2026, 10, 4, 10), 30)).toBe('closed');
      expect(refusalFor(rules(), at(8, 30), 30)).toBe('outside_hours');
      expect(refusalFor(rules(), at(18, 30), 60)).toBe('outside_hours');
      expect(refusalFor(rules(), at(12, 45), 30)).toBe('break');
      expect(
        refusalFor(rules({ closures: [{ startsAt: at(10).toISOString(), endsAt: at(12).toISOString() }] }), at(11), 30),
      ).toBe('time_off');
      expect(refusalFor(rules({ salonBookings: [{ startsAt: at(10).toISOString(), durationMin: 60 }] }), at(10, 30), 30)).toBe(
        'taken',
      );
      expect(refusalFor(rules({ clientBookings: [{ startsAt: at(10).toISOString(), durationMin: 60 }] }), at(10, 30), 30)).toBe(
        'client_busy',
      );
    });
  });

  describe("a person's own week (Phase 3)", () => {
    /** Works Wednesday afternoons only, from 14:00 to 18:00. */
    const AFTERNOONS: AvailabilityDay[] = WEEK.map((day) =>
      day.weekday === 3 ? { ...day, opensMinute: 14 * 60, closesMinute: 18 * 60, breakStartMinute: null, breakEndMinute: null } : { ...day, isOpen: false },
    );

    it('needs both the salon open and the person working', () => {
      const own = rules({ personalAvailability: AFTERNOONS });
      expect(refusalFor(own, at(10), 30)).toBe('staff_off');
      expect(refusalFor(own, at(17, 30), 60)).toBe('staff_off');
      expect(refusalFor(own, at(15), 60)).toBeNull();
      // The salon's own hours still bind: Sunday is closed whatever the person's week says.
      expect(refusalFor(rules({ personalAvailability: WEEK.map((day) => ({ ...day, isOpen: true })) }), parisTime(2026, 10, 4, 10), 30)).toBe(
        'closed',
      );
    });

    it("shows a day the person doesn't work as closed", () => {
      expect(slotsForDay(rules({ personalAvailability: AFTERNOONS }), '2026-10-01', 30)).toEqual({
        date: '2026-10-01',
        closed: true,
        slots: [],
      });
    });
  });

  describe('a team (Phase 3)', () => {
    const person = (staffId: string, position: number, overrides: Partial<BookingRules> = {}): PersonRules => ({
      staffId,
      position,
      rules: rules(overrides),
    });
    const busy = (hour: number, durationMin = 60) => ({ startsAt: at(hour).toISOString(), durationMin });

    it('offers a time as long as one person is free', () => {
      const team = [person('sofia', 0, { salonBookings: [busy(10)] }), person('nadia', 1)];

      expect(teamRefusal(team, at(10), 60)).toBeNull();
      expect(freeLabels(slotsForTeam(team, WEDNESDAY, 60))).toContain('10:00');
    });

    it('refuses a time when everyone is taken, with the reason that tells the client most', () => {
      const team = [
        person('sofia', 0, { salonBookings: [busy(10)] }),
        person('nadia', 1, { closures: [{ startsAt: at(9).toISOString(), endsAt: at(12).toISOString() }] }),
      ];

      expect(teamRefusal(team, at(10), 60)).toBe('taken');
      expect(freeLabels(slotsForTeam(team, WEDNESDAY, 60))).not.toContain('10:00');
      expect(teamRefusal([], at(10), 60)).toBe('staff_off');
    });

    it('is closed on a day nobody works', () => {
      const off = { personalAvailability: WEEK.map((day) => ({ ...day, isOpen: day.weekday !== 3 })) };
      expect(slotsForTeam([person('sofia', 0, off), person('nadia', 1, off)], WEDNESDAY, 30).closed).toBe(true);
      expect(slotsForTeam([], WEDNESDAY, 30)).toEqual({ date: WEDNESDAY, closed: true, slots: [] });
    });

    it('holds the free person with the fewest booked minutes that day, then the first in the team', () => {
      const team = [
        person('sofia', 0, { salonBookings: [busy(9), busy(15, 120)] }),
        person('nadia', 1, { salonBookings: [busy(9)] }),
        person('lina', 2, { salonBookings: [busy(11)] }),
      ];

      expect(pickPerson(team, at(16), 60)?.staffId).toBe('nadia');
      // A booking on another day doesn't count.
      const tomorrowBusy = { startsAt: parisTime(2026, 10, 1, 10).toISOString(), durationMin: 240 };
      expect(pickPerson([person('sofia', 0, { salonBookings: [tomorrowBusy] }), person('nadia', 1)], at(10), 60)?.staffId).toBe(
        'sofia',
      );
    });

    it('keeps the preferred person when they are free, and gives nobody when no one is', () => {
      const team = [person('sofia', 0), person('nadia', 1)];
      expect(pickPerson(team, at(10), 60, 'nadia')?.staffId).toBe('nadia');
      expect(pickPerson([person('sofia', 0, { salonBookings: [busy(10)] })], at(10), 60, 'sofia')).toBeNull();
    });
  });
});
