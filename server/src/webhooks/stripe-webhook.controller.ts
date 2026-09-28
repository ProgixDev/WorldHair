import { Controller, Headers, HttpCode, Post, RawBodyRequest, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { AppointmentsService } from '../appointments/appointments.service';
import { Public } from '../common/decorators/public.decorator';
import { PayoutAccountsService } from '../payments/payout-accounts.service';
import { StripeService } from '../stripe/stripe.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

/**
 * Stripe's calls. `@Public()`: the caller is Stripe itself, authenticated by
 * the signature over the raw body (see main.ts's `rawBody: true`), not by a
 * user token. Any non-2xx answer makes Stripe retry for up to three days,
 * so a failing handler is simply tried again later.
 */
@Public()
@SkipThrottle()
@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(
    private readonly stripe: StripeService,
    private readonly subscriptions: SubscriptionsService,
    private readonly appointments: AppointmentsService,
    private readonly payouts: PayoutAccountsService,
  ) {}

  /** WorldHair's own account: coiffeur subscriptions, and the clients' payments and refunds. */
  @Post()
  @HttpCode(200)
  async platform(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ): Promise<{ received: true }> {
    const event = this.stripe.constructEvent(req.rawBody, signature, 'platform');
    await this.subscriptions.handleStripeEvent(event);
    await this.appointments.handlePaymentEvent(event);
    return { received: true };
  }

  /** The salons' connected accounts — a separate endpoint in Stripe, with its own signing secret. */
  @Post('connect')
  @HttpCode(200)
  async connect(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ): Promise<{ received: true }> {
    const event = this.stripe.constructEvent(req.rawBody, signature, 'connect');
    if (event.type === 'account.updated') {
      await this.payouts.syncAccount(event.data.object);
    }
    return { received: true };
  }
}
