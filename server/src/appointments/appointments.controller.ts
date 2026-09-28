import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import {
  AppointmentsService,
  CoiffeurAppointment,
  HeldAppointment,
  ParticulierAppointment,
} from './appointments.service';
import { DaySlots } from './booking-rules';
import { AttendanceDto } from './dto/attendance.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { DecideAppointmentDto } from './dto/decide-appointment.dto';
import { RefundAppointmentDto } from './dto/refund-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { SlotsQueryDto } from './dto/slots-query.dto';

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

  /** Holds the slot and returns what the app's Stripe payment sheet needs; the salon sees nothing until it's paid. */
  @Post()
  create(@CurrentUser() current: AuthenticatedUser, @Body() dto: CreateAppointmentDto): Promise<HeldAppointment> {
    return this.appointments.create(current.id, dto);
  }

  /** After the payment sheet: Stripe is asked directly, so the request goes out at once. */
  @Post(':id/payment/confirm')
  @HttpCode(200)
  completePayment(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ParticulierAppointment> {
    return this.appointments.completePayment(current.id, id);
  }

  /** The client left the payment step: the held slot goes back to everyone. */
  @Post(':id/release')
  @HttpCode(204)
  releaseHold(@CurrentUser() current: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.appointments.releaseHold(current.id, id);
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

  /** Superseded by `slots` for the booking grid; kept for app versions that still build it themselves. */
  @Get('salon/:coiffeurId/busy')
  listBusySlots(
    @Param('coiffeurId', ParseUUIDPipe) coiffeurId: string,
  ): Promise<{ startsAt: string; durationMin: number }[]> {
    return this.appointments.listBusySlots(coiffeurId);
  }

  /** The booking grid for one day — a new booking (`serviceIds`) or moving one (`appointmentId`). */
  @Get('salon/:coiffeurId/slots')
  slots(
    @CurrentUser() current: AuthenticatedUser,
    @Param('coiffeurId', ParseUUIDPipe) coiffeurId: string,
    @Query() query: SlotsQueryDto,
  ): Promise<DaySlots> {
    return this.appointments.slots(current.id, current.role, coiffeurId, query);
  }

  // ─── Coiffeur ─────────────────────────────────────────────────────────────

  @Roles('coiffeur')
  @Get('salon')
  listForSalon(@CurrentUser() current: AuthenticatedUser): Promise<CoiffeurAppointment[]> {
    return this.appointments.listForCoiffeur(current.id);
  }

  /** Gives the client money back by hand — everything, or `amount` euros — until the salon has been paid. */
  @Roles('coiffeur')
  @Post(':id/refund')
  @HttpCode(200)
  refund(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefundAppointmentDto,
  ): Promise<{ refunded: number }> {
    return this.appointments.refundByCoiffeur(current.id, id, dto.amount);
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

  @Roles('coiffeur')
  @Patch(':id/move')
  move(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleAppointmentDto,
  ): Promise<void> {
    return this.appointments.move(current.id, id, dto.startsAt);
  }

  @Roles('coiffeur')
  @Patch(':id/attendance')
  setAttendance(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttendanceDto,
  ): Promise<void> {
    return this.appointments.setAttendance(current.id, id, dto.attendance);
  }
}
