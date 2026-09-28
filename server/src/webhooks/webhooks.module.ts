import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { PaymentsModule } from '../payments/payments.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { StripeWebhookController } from './stripe-webhook.controller';

/** One place for Stripe's calls, handed to the modules each event concerns. */
@Module({
  imports: [SubscriptionsModule, AppointmentsModule, PaymentsModule],
  controllers: [StripeWebhookController],
})
export class WebhooksModule {}
