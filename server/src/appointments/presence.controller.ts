import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { ConfirmPresenceDto } from './dto/confirm-presence.dto';
import { CompletionCode, PresenceConfirmation, PresenceService } from './presence.service';

/**
 * The end-of-service code (TODO.md): the salon, or the staff member doing
 * the booking, shows it; the client scans it.
 */
@Controller('presence')
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  /** « Afficher le code de fin »: a fresh code, replacing the last. */
  @Roles('coiffeur', 'staff')
  @Post(':appointmentId/code')
  issue(
    @CurrentUser() current: AuthenticatedUser,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
  ): Promise<CompletionCode> {
    return this.presence.issue(current.id, appointmentId);
  }

  /** Has the client scanned yet? */
  @Roles('coiffeur', 'staff')
  @Get(':appointmentId/status')
  status(
    @CurrentUser() current: AuthenticatedUser,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
  ): Promise<{ confirmedByClientAt: string | null }> {
    return this.presence.status(current.id, appointmentId);
  }

  /** The client's scan. */
  @Roles('particulier')
  @Post('confirm')
  @HttpCode(200)
  confirm(@CurrentUser() current: AuthenticatedUser, @Body() dto: ConfirmPresenceDto): Promise<PresenceConfirmation> {
    return this.presence.confirm(current.id, dto.code);
  }
}
