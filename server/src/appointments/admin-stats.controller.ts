import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminStatsService, BookingStats } from './admin-stats.service';
import { BookingStatsQueryDto } from './dto/booking-stats.dto';

/**
 * Real numbers for the dashboard's "Réservations" chart. Both admin tiers
 * via `@Roles('admin', 'admin_limited')`, enforced by the global `RolesGuard`.
 */
@Roles('admin', 'admin_limited')
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly stats: AdminStatsService) {}

  @Get('bookings')
  async bookings(@Query() query: BookingStatsQueryDto): Promise<BookingStats> {
    return this.stats.getBookingStats(query.range);
  }
}
