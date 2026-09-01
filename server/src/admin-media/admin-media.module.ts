import { Module } from '@nestjs/common';
import { AdminMediaController } from './admin-media.controller';

// No explicit SupabaseService import needed — DatabaseModule is @Global().
@Module({
  controllers: [AdminMediaController],
})
export class AdminMediaModule {}
