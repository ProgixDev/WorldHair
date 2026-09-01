import { Module } from '@nestjs/common';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

// No explicit SupabaseService import needed — DatabaseModule is @Global().
@Module({
  controllers: [SubscriptionsController, AdminSubscriptionsController],
  providers: [SubscriptionsService],
})
export class SubscriptionsModule {}
