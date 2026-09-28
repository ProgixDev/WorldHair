import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { toPaginationOptions } from '../common/dto/pagination-query.dto';
import { AdminAppointmentDetail, AdminAppointmentsService, AdminAppointmentSummary } from './admin-appointments.service';
import { AppointmentsService } from './appointments.service';
import { AdminAppointmentsQueryDto } from './dto/admin-appointments-query.dto';
import { AdminCancelAppointmentDto } from './dto/admin-cancel-appointment.dto';

/**
 * `/admin/rendez-vous` (TODO.md Phase 7): every booking, one in full, and
 * its cancellation to settle a dispute. Both admin tiers via
 * `@Roles('admin', 'admin_limited')`, like the payments page they refund from.
 */
@Roles('admin', 'admin_limited')
@Controller('admin/appointments')
export class AdminAppointmentsController {
  constructor(
    private readonly admin: AdminAppointmentsService,
    private readonly appointments: AppointmentsService,
  ) {}

  @Get()
  list(@Query() query: AdminAppointmentsQueryDto): Promise<{ items: AdminAppointmentSummary[]; total: number }> {
    return this.admin.list({
      status: query.status,
      salon: query.salon,
      client: query.client,
      from: query.from,
      to: query.to,
      ...toPaginationOptions(query),
    });
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<AdminAppointmentDetail> {
    return this.admin.detail(id);
  }

  @Patch(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminCancelAppointmentDto,
  ): Promise<{ refunded: number; refundFailed: boolean }> {
    return this.appointments.cancelByAdmin(id, dto.reason);
  }
}
