import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { EnvironmentVariables } from '../config/env.validation';
import { STRIPE_CLIENT, StripeService } from './stripe.service';

@Global()
@Module({
  providers: [
    {
      provide: STRIPE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>): Stripe | null => {
        const key = config.get('STRIPE_SECRET_KEY', { infer: true });
        return key ? new Stripe(key, { appInfo: { name: 'WorldHair' } }) : null;
      },
    },
    StripeService,
  ],
  exports: [StripeService],
})
export class StripeModule {}
