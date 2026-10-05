import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { AppointmentsService, CoiffeurAppointment } from './appointments.service';

/** A staff member's own agenda, read-only (TODO.md Phase 3) — marking honoré/absent is PATCH /appointments/:id/attendance. */
@Roles('staff')
@Controller('staff/me')
export class StaffAppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get('appointments')
  list(@CurrentUser() current: AuthenticatedUser): Promise<CoiffeurAppointment[]> {
    return this.appointments.listForStaff(current.id);
  }
}
