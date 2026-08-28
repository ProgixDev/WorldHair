import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { AppointmentsService, CoiffeurAppointment, ParticulierAppointment } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { DecideAppointmentDto } from './dto/decide-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';

/**
 * "Rendez-vous / Agenda" (TODO.md). No class-level `@Roles()`: particulier
 * and coiffeur routes are mixed here since both sides read/write the same
 * underlying appointments table, just through different lenses — see
 * AppointmentsService's two response shapes.
 */
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  // ─── Particulier ─────────────────────────────────────────────────────────

  @Get('me')
  listMine(@CurrentUser() current: AuthenticatedUser): Promise<ParticulierAppointment[]> {
    return this.appointments.listForParticulier(current.id);
  }

  @Post()
  create(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: CreateAppointmentDto,
  ): Promise<ParticulierAppointment> {
    return this.appointments.create(current.id, dto);
  }

  @Patch(':id/reschedule')
  reschedule(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleAppointmentDto,
  ): Promise<ParticulierAppointment> {
    return this.appointments.reschedule(current.id, id, dto.startsAt);
  }

  // ─── Shared (either side of the booking may cancel) ──────────────────────

  @Patch(':id/cancel')
  cancel(@CurrentUser() current: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.appointments.cancel(current.id, id);
  }

  /** Public (any authenticated caller) — feeds the booking flow's slot picker. */
  @Get('salon/:coiffeurId/busy')
  listBusySlots(
    @Param('coiffeurId', ParseUUIDPipe) coiffeurId: string,
  ): Promise<{ startsAt: string; durationMin: number }[]> {
    return this.appointments.listBusySlots(coiffeurId);
  }

  // ─── Coiffeur ─────────────────────────────────────────────────────────────

  @Roles('coiffeur')
  @Get('salon')
  listForSalon(@CurrentUser() current: AuthenticatedUser): Promise<CoiffeurAppointment[]> {
    return this.appointments.listForCoiffeur(current.id);
  }

  @Roles('coiffeur')
  @Patch(':id/decide')
  decide(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideAppointmentDto,
  ): Promise<void> {
    return this.appointments.decide(current.id, id, dto.decision);
  }
}
