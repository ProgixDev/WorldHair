import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationPreferences, NotificationsService } from './notifications.service';
import { PushTokensService } from './push-tokens.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly pushTokens: PushTokensService,
    private readonly notifications: NotificationsService,
  ) {}

  @Post('push-tokens')
  register(@CurrentUser() current: AuthenticatedUser, @Body() dto: RegisterPushTokenDto): Promise<void> {
    return this.pushTokens.register(current.id, dto.token, dto.platform, dto.timezone);
  }

  @Delete('push-tokens/:token')
  unregister(@CurrentUser() current: AuthenticatedUser, @Param('token') token: string): Promise<void> {
    return this.pushTokens.unregister(current.id, token);
  }

  @Get('preferences')
  getPreferences(@CurrentUser() current: AuthenticatedUser): Promise<NotificationPreferences> {
    return this.notifications.getPreferences(current.id);
  }

  @Patch('preferences')
  updatePreferences(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    return this.notifications.updatePreferences(current.id, dto);
  }
}
