import type Stripe from 'stripe';

/** What the setup script (scripts/stripe-setup.ts) creates: one price per plan, found by lookup key. */
const PRICES = [
  { id: 'price_monthly', lookup_key: 'worldhair_pro_monthly', unit_amount: 1900, currency: 'eur', recurring: { interval: 'month' } },
  { id: 'price_yearly', lookup_key: 'worldhair_pro_yearly', unit_amount: 18200, currency: 'eur', recurring: { interval: 'year' } },
];

export interface FakeSubscriptionInput {
  id: string;
  customer: string;
  status: Stripe.Subscription.Status;
  profileId?: string;
  plan?: 'monthly' | 'yearly';
  /** Unix seconds, like Stripe. */
  trialEnd?: number | null;
  currentPeriodEnd?: number;
  cancelAt?: number | null;
  cancelAtPeriodEnd?: boolean;
}

/**
 * Stands in for the Stripe client in tests: the handful of calls
 * SubscriptionsService makes, in memory, no network. Webhook signatures
 * stay real — specs sign payloads with Stripe's own test helper and
 * StripeService checks them with the real code.
 */
export class FakeStripe {
  readonly customersCreated: Stripe.CustomerCreateParams[] = [];
  readonly checkoutSessionsCreated: Stripe.Checkout.SessionCreateParams[] = [];
  readonly portalSessionsCreated: Stripe.BillingPortal.SessionCreateParams[] = [];
  /** Set to [] to play a Stripe account where the setup script was never run. */
  prices_: typeof PRICES = PRICES;
  portalConfigurations: { id: string; metadata: Record<string, string> }[] = [];
  private readonly subscriptionsById = new Map<string, unknown>();

  readonly customers = {
    create: async (params: Stripe.CustomerCreateParams) => {
      this.customersCreated.push(params);
      return { id: `cus_test_${this.customersCreated.length}` };
    },
  };

  readonly checkout = {
    sessions: {
      create: async (params: Stripe.Checkout.SessionCreateParams) => {
        this.checkoutSessionsCreated.push(params);
        const id = `cs_test_${this.checkoutSessionsCreated.length}`;
        return { id, url: `https://checkout.stripe.test/${id}` };
      },
    },
  };

  readonly billingPortal = {
    sessions: {
      create: async (params: Stripe.BillingPortal.SessionCreateParams) => {
        this.portalSessionsCreated.push(params);
        return { url: 'https://billing.stripe.test/session' };
      },
    },
    configurations: {
      list: async () => ({ data: this.portalConfigurations }),
    },
  };

  readonly prices = {
    list: async (params: Stripe.PriceListParams) => ({
      data: this.prices_.filter((price) => params.lookup_keys?.includes(price.lookup_key)),
    }),
  };

  readonly subscriptions = {
    retrieve: async (id: string) => {
      const subscription = this.subscriptionsById.get(id);
      if (!subscription) throw new Error(`No such subscription: '${id}'`);
      return subscription;
    },
  };

  /** Test convenience: the subscription as `subscriptions.retrieve` returns it from now on. */
  putSubscription(input: FakeSubscriptionInput): Stripe.Subscription {
    const price = PRICES[input.plan === 'yearly' ? 1 : 0];
    const subscription = {
      id: input.id,
      object: 'subscription',
      customer: input.customer,
      status: input.status,
      metadata: input.profileId ? { profile_id: input.profileId } : {},
      trial_end: input.trialEnd ?? null,
      cancel_at: input.cancelAt ?? null,
      cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
      items: {
        object: 'list',
        data: [{ id: `si_${input.id}`, current_period_end: input.currentPeriodEnd ?? 0, price }],
      },
    };
    this.subscriptionsById.set(input.id, subscription);
    return subscription as unknown as Stripe.Subscription;
  }
}
