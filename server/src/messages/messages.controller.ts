import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { CoiffeurMessageDto, toCoiffeurMessageDto } from './dto/message.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesService } from './messages.service';

/**
 * The coiffeur's own side of "messagerie interne admin ↔ coiffeur" — no
 * mobile screen calls this yet, but it exists so that work is just a UI task
 * later, same as the admin side already built in `admin-messages.controller.ts`.
 */
@Roles('coiffeur')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('mine')
  async getMine(@CurrentUser() current: AuthenticatedUser): Promise<CoiffeurMessageDto[]> {
    return (await this.messages.getMine(current.id)).map(toCoiffeurMessageDto);
  }

  @Post('mine')
  async send(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: SendMessageDto,
  ): Promise<CoiffeurMessageDto> {
    return toCoiffeurMessageDto(await this.messages.sendAsCoiffeur(current.id, dto.body));
  }
}
