import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { JoinSalonDto } from './dto/staff.dto';
import { StaffMembership, StaffService } from './staff.service';

/**
 * A coiffeur working in someone else's salon (TODO.md Phase 3): joining it
 * with the owner's code, where they work, leaving. Their agenda is
 * GET /staff/me/appointments (appointments module).
 */
@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  /** « Rejoindre un salon »: right after sign-up (still a client account), or a staff account between salons. */
  @Roles('particulier', 'staff')
  @Post('join')
  join(@CurrentUser() current: AuthenticatedUser, @Body() dto: JoinSalonDto): Promise<StaffMembership> {
    return this.staff.join(current.id, dto.code);
  }

  /** Where this account works — `null` for a staff account not (or no longer) in a salon. */
  @Roles('staff')
  @Get('me')
  async me(@CurrentUser() current: AuthenticatedUser): Promise<{ membership: StaffMembership | null }> {
    return { membership: await this.staff.membershipOf(current.id) };
  }

  @Roles('staff')
  @Post('me/leave')
  @HttpCode(204)
  leave(@CurrentUser() current: AuthenticatedUser): Promise<void> {
    return this.staff.leave(current.id);
  }
}
