import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { CoiffeurMessageDto, ThreadSummaryDto, toCoiffeurMessageDto, toThreadSummaryDto } from './dto/message.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesService } from './messages.service';

/**
 * "Messagerie interne admin ↔ coiffeur" (TODO.md → Back-office admin).
 * `@Roles('admin')` is enforced by the global `RolesGuard`.
 */
@Roles('admin')
@Controller('admin/messages')
export class AdminMessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('threads')
  async listThreads(): Promise<ThreadSummaryDto[]> {
    return (await this.messages.listThreadsForAdmin()).map(toThreadSummaryDto);
  }

  @Get('threads/:coiffeurId')
  async getThread(@Param('coiffeurId', ParseUUIDPipe) coiffeurId: string): Promise<CoiffeurMessageDto[]> {
    return (await this.messages.getThreadForAdmin(coiffeurId)).map(toCoiffeurMessageDto);
  }

  @Post('threads/:coiffeurId')
  async send(
    @CurrentUser() current: AuthenticatedUser,
    @Param('coiffeurId', ParseUUIDPipe) coiffeurId: string,
    @Body() dto: SendMessageDto,
  ): Promise<CoiffeurMessageDto> {
    return toCoiffeurMessageDto(await this.messages.sendAsAdmin(current.id, coiffeurId, dto.body));
  }
}
