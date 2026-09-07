import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

export type StatsRange = 'day' | 'week' | 'month';

export interface BookingStatsPoint {
  label: string;
  confirmed: number;
  cancelled: number;
  /** Sum of `price` for confirmed appointments created in this bucket. */
  revenue: number;
}

export interface BookingStats {
  range: StatsRange;
  points: BookingStatsPoint[];
}

interface Bucket {
  label: string;
  startMs: number;
  endMs: number;
}

const DAY_HOURS = [6, 8, 10, 12, 14, 16, 18, 20];
const WEEK_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

function dayBuckets(now: Date): Bucket[] {
  const dayStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return DAY_HOURS.map((hour) => ({
    label: `${hour}h`,
    startMs: dayStartMs + hour * 3_600_000,
    endMs: dayStartMs + (hour + 2) * 3_600_000,
  }));
}

/** Current ISO week (Monday–Sunday), not a rolling last-7-days window. */
function weekBuckets(now: Date): Bucket[] {
  const dayStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const isoDayOfWeek = (now.getUTCDay() + 6) % 7; // 0 = Monday .. 6 = Sunday
  const mondayMs = dayStartMs - isoDayOfWeek * 86_400_000;
  return WEEK_LABELS.map((label, i) => ({
    label,
    startMs: mondayMs + i * 86_400_000,
    endMs: mondayMs + (i + 1) * 86_400_000,
  }));
}

/** Current calendar year, Jan–Dec. */
function monthBuckets(now: Date): Bucket[] {
  const year = now.getUTCFullYear();
  return MONTH_LABELS.map((label, i) => ({
    label,
    startMs: Date.UTC(year, i, 1),
    endMs: Date.UTC(year, i + 1, 1),
  }));
}

function bucketsFor(range: StatsRange, now: Date): Bucket[] {
  if (range === 'day') return dayBuckets(now);
  if (range === 'week') return weekBuckets(now);
  return monthBuckets(now);
}

interface AppointmentStatsRow {
  status: string;
  created_at: string;
  price: string | number;
}

/**
 * Backs the dashboard's revenue chart (`/admin` →
 * `components/admin/dashboard/RevenueChart.tsx`) — real revenue and booking
 * counts by `created_at`. Reads the same `appointments` table
 * `AppointmentsService` owns; lives here rather than a separate module for
 * that reason.
 */
@Injectable()
export class AdminStatsService {
  constructor(private readonly supabase: SupabaseService) {}

  async getBookingStats(range: StatsRange): Promise<BookingStats> {
    const now = new Date();
    const buckets = bucketsFor(range, now);
    const earliest = new Date(buckets[0].startMs).toISOString();

    const { data, error } = await this.supabase.client
      .from('appointments')
      .select('status, created_at, price')
      .gte('created_at', earliest);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const rows = data as AppointmentStatsRow[];

    const points = buckets.map((bucket) => {
      const inBucket = rows.filter((row) => {
        const createdAtMs = new Date(row.created_at).getTime();
        return createdAtMs >= bucket.startMs && createdAtMs < bucket.endMs;
      });
      const confirmedRows = inBucket.filter((row) => row.status === 'confirmed');
      return {
        label: bucket.label,
        confirmed: confirmedRows.length,
        cancelled: inBucket.filter((row) => row.status === 'cancelled').length,
        revenue: confirmedRows.reduce((sum, row) => sum + Number(row.price), 0),
      };
    });

    return { range, points };
  }
}
