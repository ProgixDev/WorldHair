import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { parisParts, parisTime } from '../common/utils/paris-time';
import { SupabaseService } from '../database/supabase.service';
import { AdminStatsService } from './admin-stats.service';

/** Today at hour:minute on a Paris clock (the suite itself runs in UTC). */
function parisToday(hour: number, minute = 0): string {
  const today = parisParts(new Date());
  return parisTime(today.year, today.month, today.day, hour, minute).toISOString();
}

describe('AdminStatsService', () => {
  let supabase: FakeSupabaseService;
  let service: AdminStatsService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    service = new AdminStatsService(supabase as unknown as SupabaseService);
  });

  it('getBookingStats("day") returns 8 points labeled by hour', async () => {
    const stats = await service.getBookingStats('day');

    expect(stats.range).toBe('day');
    expect(stats.points.map((p) => p.label)).toEqual([
      '6h', '8h', '10h', '12h', '14h', '16h', '18h', '20h',
    ]);
  });

  it('getBookingStats("month") returns 12 points labeled Jan..Déc', async () => {
    const stats = await service.getBookingStats('month');

    expect(stats.points.map((p) => p.label)).toEqual([
      'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc',
    ]);
  });

  it('getBookingStats("day") buckets by Paris hours: 07:30 in Paris counts in "6h"', async () => {
    const earlyMorning = parisToday(7, 30);
    supabase.seedAppointment({
      particulierId: 'p1', coiffeurId: 'c1', startsAt: earlyMorning, status: 'confirmed', createdAt: earlyMorning, price: 50,
    });

    const stats = await service.getBookingStats('day');

    expect(stats.points[0]).toMatchObject({ label: '6h', confirmed: 1 });
  });

  it('getBookingStats("week") counts a booking made just after midnight in Paris on that Paris day', async () => {
    const justAfterMidnight = parisToday(0, 30);
    supabase.seedAppointment({
      particulierId: 'p1', coiffeurId: 'c1', startsAt: justAfterMidnight, status: 'confirmed', createdAt: justAfterMidnight,
    });

    const stats = await service.getBookingStats('week');

    const isoDayOfWeek = (parisParts(new Date()).weekday + 6) % 7; // 0 = Monday
    expect(stats.points[isoDayOfWeek].confirmed).toBe(1);
  });

  it('getBookingStats("month") counts a booking made just after midnight on 1 January in Paris in "Jan"', async () => {
    const newYear = parisTime(parisParts(new Date()).year, 1, 1, 0, 30).toISOString();
    supabase.seedAppointment({
      particulierId: 'p1', coiffeurId: 'c1', startsAt: newYear, status: 'confirmed', createdAt: newYear,
    });

    const stats = await service.getBookingStats('month');

    expect(stats.points[0]).toMatchObject({ label: 'Jan', confirmed: 1 });
  });

  it('getBookingStats("week") counts today\'s confirmed and cancelled appointments into today\'s bucket', async () => {
    const todayNoonIso = parisToday(12);

    supabase.seedAppointment({
      particulierId: 'p1', coiffeurId: 'c1', startsAt: todayNoonIso, status: 'confirmed', createdAt: todayNoonIso, price: 50,
    });
    supabase.seedAppointment({
      particulierId: 'p2', coiffeurId: 'c1', startsAt: todayNoonIso, status: 'cancelled', createdAt: todayNoonIso, price: 30,
    });
    // A pending appointment shouldn't count toward either series.
    supabase.seedAppointment({
      particulierId: 'p3', coiffeurId: 'c1', startsAt: todayNoonIso, status: 'pending', createdAt: todayNoonIso,
    });

    const stats = await service.getBookingStats('week');

    expect(stats.points).toHaveLength(7);
    expect(stats.points.reduce((sum, p) => sum + p.confirmed, 0)).toBe(1);
    expect(stats.points.reduce((sum, p) => sum + p.cancelled, 0)).toBe(1);

    const isoDayOfWeek = (parisParts(new Date()).weekday + 6) % 7; // 0 = Monday
    expect(stats.points[isoDayOfWeek]).toMatchObject({ confirmed: 1, cancelled: 1 });
    // Revenue counts only the confirmed appointment's price — the cancelled
    // one's 30 must not leak in.
    expect(stats.points[isoDayOfWeek].revenue).toBe(50);
  });

  it('counts every booking of the range, past the 1 000 rows PostgREST answers at most', async () => {
    const todayNoonIso = parisToday(12);
    for (let i = 0; i < 1005; i++) {
      supabase.seedAppointment({ particulierId: 'p1', coiffeurId: 'c1', startsAt: todayNoonIso, status: 'confirmed', createdAt: todayNoonIso });
    }

    const stats = await service.getBookingStats('week');

    expect(stats.points.reduce((sum, p) => sum + p.confirmed, 0)).toBe(1005);
  });

  it('an appointment created well before the range window is not counted', async () => {
    const longAgoIso = new Date(Date.UTC(2000, 0, 1)).toISOString();
    supabase.seedAppointment({
      particulierId: 'p1', coiffeurId: 'c1', startsAt: longAgoIso, status: 'confirmed', createdAt: longAgoIso,
    });

    const stats = await service.getBookingStats('week');

    expect(stats.points.reduce((sum, p) => sum + p.confirmed, 0)).toBe(0);
  });
});
