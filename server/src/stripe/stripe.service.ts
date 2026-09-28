import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { EnvironmentVariables } from '../config/env.validation';

/** The Stripe client, or `null` while STRIPE_SECRET_KEY is empty. Specs replace it with FakeStripe. */
export const STRIPE_CLIENT = Symbol('STRIPE_CLIENT');

/**
 * The client's Stripe account (TODO.md Phase 4). Without a key the server
 * still boots and runs; only the calls that need Stripe answer 503.
 */
@Injectable()
export class StripeService {
  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe | null,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  get client(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException('Stripe is not configured (STRIPE_SECRET_KEY)');
    }
    return this.stripe;
  }

  /** Checks Stripe's signature over the exact bytes received: a forged or replayed call never reaches the handlers. */
  constructEvent(rawBody: Buffer | undefined, signature: string | undefined): Stripe.Event {
    const secret = this.config.get('STRIPE_WEBHOOK_SECRET', { infer: true });
    if (!secret) {
      throw new ServiceUnavailableException('Stripe webhooks are not configured (STRIPE_WEBHOOK_SECRET)');
    }
    if (!rawBody || !signature) {
      throw new BadRequestException('Missing Stripe signature');
    }
    try {
      return Stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      throw new BadRequestException('Invalid Stripe signature');
    }
  }

  /** A page of Stripe's dashboard — its test side while the key is a test one. */
  dashboardUrl(path: string): string {
    const testMode = /^(sk|rk)_test_/.test(this.config.get('STRIPE_SECRET_KEY', { infer: true }) ?? '');
    return `https://dashboard.stripe.com${testMode ? '/test' : ''}/${path}`;
  }
}
