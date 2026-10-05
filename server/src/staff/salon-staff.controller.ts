import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { StaffHoursDto, UpdateStaffDto } from './dto/staff.dto';
import { SalonInvite, StaffMember, StaffService } from './staff.service';

/**
 * The owner's « Équipe » (TODO.md Phase 3): who works in his salon, their
 * own week, whether clients' bookings go to them, the codes to join it.
 * Each person's congés go through /salon/me/time-off with a `staffId`.
 */
@Roles('coiffeur')
@Controller('salon/me')
export class SalonStaffController {
  constructor(private readonly staff: StaffService) {}

  @Get('staff')
  team(@CurrentUser() current: AuthenticatedUser): Promise<StaffMember[]> {
    return this.staff.team(current.id);
  }

  @Patch('staff/:id')
  update(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
  ): Promise<StaffMember> {
    return this.staff.setTakesBookings(current.id, id, dto.takesBookings);
  }

  @Put('staff/:id/hours')
  replaceHours(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StaffHoursDto,
  ): Promise<StaffMember> {
    return this.staff.replaceHours(
      current.id,
      id,
      dto.days?.map((day) => ({ ...day, breakStartMinute: day.breakStartMinute ?? null, breakEndMinute: day.breakEndMinute ?? null })) ??
        null,
    );
  }

  @Delete('staff/:id')
  @HttpCode(204)
  remove(@CurrentUser() current: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.staff.remove(current.id, id);
  }

  @Get('invites')
  invites(@CurrentUser() current: AuthenticatedUser): Promise<SalonInvite[]> {
    return this.staff.listInvites(current.id);
  }

  @Post('invites')
  createInvite(@CurrentUser() current: AuthenticatedUser): Promise<SalonInvite> {
    return this.staff.createInvite(current.id);
  }

  @Delete('invites/:code')
  @HttpCode(204)
  revokeInvite(@CurrentUser() current: AuthenticatedUser, @Param('code') code: string): Promise<void> {
    return this.staff.revokeInvite(current.id, code);
  }
}
