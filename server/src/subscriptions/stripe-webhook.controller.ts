import { Controller, Headers, HttpCode, Post, RawBodyRequest, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { StripeService } from '../stripe/stripe.service';
import { SubscriptionsService } from './subscriptions.service';

/**
 * Stripe's calls about subscriptions and invoices. `@Public()`: the caller
 * is Stripe itself, authenticated by the signature over the raw body (see
 * main.ts's `rawBody: true`), not by a user token. Any non-2xx answer makes
 * Stripe retry for up to three days.
 */
@Public()
@SkipThrottle()
@Controller('webhooks')
export class StripeWebhookController {
  constructor(
    private readonly stripe: StripeService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  @Post('stripe')
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ): Promise<{ received: true }> {
    const event = this.stripe.constructEvent(req.rawBody, signature);
    await this.subscriptions.handleStripeEvent(event);
    return { received: true };
  }
}
