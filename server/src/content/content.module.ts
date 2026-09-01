import { Module } from '@nestjs/common';
import { AdminContentController } from './admin-content.controller';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

// No explicit SupabaseService import needed — DatabaseModule is @Global().
@Module({
  controllers: [ContentController, AdminContentController],
  providers: [ContentService],
})
export class ContentModule {}
