import { Module } from '@nestjs/common';
import { AdminMessagesController } from './admin-messages.controller';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

// No explicit SupabaseService import needed — DatabaseModule is @Global().
@Module({
  controllers: [MessagesController, AdminMessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
