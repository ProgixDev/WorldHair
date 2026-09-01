import { Module } from '@nestjs/common';
import { AdminAdSlotsController } from './admin-ad-slots.controller';
import { AdSlotsController } from './ad-slots.controller';
import { AdSlotsService } from './ad-slots.service';

// No explicit SupabaseService import needed — DatabaseModule is @Global().
@Module({
  controllers: [AdSlotsController, AdminAdSlotsController],
  providers: [AdSlotsService],
})
export class AdSlotsModule {}
