import { Module } from '@nestjs/common';
import { CoiffeurModule } from '../coiffeur/coiffeur.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { StripeWebhookController } from './stripe-webhook.controller';
import { SubscriptionRemindersJob } from './subscription-reminders.job';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

// No explicit SupabaseService/StripeService import needed — DatabaseModule and StripeModule are @Global().
@Module({
  imports: [CoiffeurModule, MailModule, NotificationsModule, SettingsModule],
  controllers: [SubscriptionsController, AdminSubscriptionsController, StripeWebhookController],
  providers: [SubscriptionsService, SubscriptionRemindersJob],
})
export class SubscriptionsModule {}
