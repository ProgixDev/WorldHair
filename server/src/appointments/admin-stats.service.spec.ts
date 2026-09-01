import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { SupabaseService } from '../database/supabase.service';
import { AdminStatsService } from './admin-stats.service';

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

  it('getBookingStats("week") counts today\'s confirmed and cancelled appointments into today\'s bucket', async () => {
    const now = new Date();
    const todayStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const todayNoonIso = new Date(todayStartMs + 12 * 3_600_000).toISOString();

    supabase.seedAppointment({
      particulierId: 'p1', coiffeurId: 'c1', startsAt: todayNoonIso, status: 'confirmed', createdAt: todayNoonIso,
    });
    supabase.seedAppointment({
      particulierId: 'p2', coiffeurId: 'c1', startsAt: todayNoonIso, status: 'cancelled', createdAt: todayNoonIso,
    });
    // A pending appointment shouldn't count toward either series.
    supabase.seedAppointment({
      particulierId: 'p3', coiffeurId: 'c1', startsAt: todayNoonIso, status: 'pending', createdAt: todayNoonIso,
    });

    const stats = await service.getBookingStats('week');

    expect(stats.points).toHaveLength(7);
    expect(stats.points.reduce((sum, p) => sum + p.confirmed, 0)).toBe(1);
    expect(stats.points.reduce((sum, p) => sum + p.cancelled, 0)).toBe(1);

    const isoDayOfWeek = (now.getUTCDay() + 6) % 7; // 0 = Monday
    expect(stats.points[isoDayOfWeek]).toMatchObject({ confirmed: 1, cancelled: 1 });
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
