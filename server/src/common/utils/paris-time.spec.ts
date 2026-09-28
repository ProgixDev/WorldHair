import { formatParisDateTime, parisParts, parisTime } from './paris-time';

describe('paris-time', () => {
  it('runs the suite in UTC, like the production server', () => {
    expect(new Date(Date.UTC(2026, 6, 1)).getTimezoneOffset()).toBe(0);
  });

  describe('parisParts', () => {
    it('reads summer time as UTC+2', () => {
      // Wednesday 1 July 2026, 08:00 UTC
      expect(parisParts(new Date('2026-07-01T08:00:00Z'))).toEqual({
        year: 2026,
        month: 7,
        day: 1,
        weekday: 3,
        hour: 10,
        minute: 0,
      });
    });

    it('reads winter time as UTC+1', () => {
      expect(parisParts(new Date('2026-01-15T08:30:00Z'))).toMatchObject({ hour: 9, minute: 30 });
    });

    it('moves to the next Paris day before UTC does', () => {
      // Sunday 23:30 UTC in summer is already Monday 01:30 in Paris.
      expect(parisParts(new Date('2026-07-05T23:30:00Z'))).toMatchObject({ day: 6, weekday: 1, hour: 1 });
    });

    it('reads midnight as hour 0, never 24', () => {
      expect(parisParts(new Date('2026-01-14T23:00:00Z'))).toMatchObject({ day: 15, hour: 0 });
    });
  });

  describe('parisTime', () => {
    it('turns a Paris wall-clock time into the right instant, summer and winter', () => {
      expect(parisTime(2026, 7, 1, 9, 0).toISOString()).toBe('2026-07-01T07:00:00.000Z');
      expect(parisTime(2026, 1, 15, 9, 0).toISOString()).toBe('2026-01-15T08:00:00.000Z');
    });

    it('handles the days the clocks change', () => {
      // 29 March 2026: clocks go forward at 02:00. Midnight is still winter time, noon is summer time.
      expect(parisTime(2026, 3, 29, 0, 0).toISOString()).toBe('2026-03-28T23:00:00.000Z');
      expect(parisTime(2026, 3, 29, 12, 0).toISOString()).toBe('2026-03-29T10:00:00.000Z');
      // 25 October 2026: clocks go back at 03:00.
      expect(parisTime(2026, 10, 25, 0, 0).toISOString()).toBe('2026-10-24T22:00:00.000Z');
      expect(parisTime(2026, 10, 25, 12, 0).toISOString()).toBe('2026-10-25T11:00:00.000Z');
    });

    it('normalises an overflowing day, like Date.UTC', () => {
      expect(parisTime(2026, 1, 32, 9, 0).toISOString()).toBe('2026-02-01T08:00:00.000Z');
    });
  });

  describe('formatParisDateTime', () => {
    it('writes an instant the way a French notification reads it, on a Paris clock', () => {
      expect(formatParisDateTime('2026-09-30T08:00:00Z')).toBe('mer. 30 sept. à 10:00');
      expect(formatParisDateTime('2026-01-15T17:05:00Z')).toBe('jeu. 15 janv. à 18:05');
    });
  });
});
