import { IsIn } from 'class-validator';
import { StatsRange } from '../admin-stats.service';

export class BookingStatsQueryDto {
  @IsIn(['day', 'week', 'month'])
  range!: StatsRange;
}
