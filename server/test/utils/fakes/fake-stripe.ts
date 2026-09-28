import type Stripe from 'stripe';

/** What the setup script (scripts/stripe-setup.ts) creates: one price per plan, found by lookup key. */
const PRICES = [
  { id: 'price_monthly', lookup_key: 'worldhair_pro_monthly', unit_amount: 1900, currency: 'eur', recurring: { interval: 'month' } },
  { id: 'price_yearly', lookup_key: 'worldhair_pro_yearly', unit_amount: 18200, currency: 'eur', recurring: { interval: 'year' } },
];

const nowSeconds = () => Math.floor(Date.now() / 1000);

export interface FakeSubscriptionInput {
  id: string;
  customer: string;
  status: Stripe.Subscription.Status;
  profileId?: string;
  plan?: 'monthly' | 'yearly';
  /** Unix seconds, like Stripe. */
  trialEnd?: number | null;
  /** Unix seconds; a month ahead by default, as a running subscription has. */
  currentPeriodEnd?: number;
  cancelAt?: number | null;
  cancelAtPeriodEnd?: boolean;
}

interface FakeSession {
  id: string;
  customer: string;
  status: 'open' | 'complete' | 'expired';
  url: string;
}

/**
 * Stands in for the Stripe client in tests: the handful of calls
 * SubscriptionsService makes, in memory, no network. Webhook signatures
 * stay real — specs sign payloads with Stripe's own test helper and
 * StripeService checks them with the real code.
 */
export class FakeStripe {
  readonly customersCreated: { params: Stripe.CustomerCreateParams; idempotencyKey?: string }[] = [];
  readonly checkoutSessionsCreated: Stripe.Checkout.SessionCreateParams[] = [];
  readonly portalSessionsCreated: Stripe.BillingPortal.SessionCreateParams[] = [];
  /** Set to [] to play a Stripe account where the setup script was never run. */
  prices_: typeof PRICES = PRICES;
  portalConfigurations: { id: string; metadata: Record<string, string> }[] = [];
  /** Milliseconds each coming `subscriptions.retrieve` waits before answering, in call order. */
  retrieveDelays: number[] = [];
  private readonly subscriptionsById = new Map<string, Record<string, unknown>>();
  private readonly customerIdByKey = new Map<string, string>();
  private readonly sessions: FakeSession[] = [];
  private customerCount = 0;

  readonly customers = {
    /** Like Stripe, a repeated idempotency key answers with the customer the first call made. */
    create: async (params: Stripe.CustomerCreateParams, options?: Stripe.RequestOptions) => {
      const key = options?.idempotencyKey;
      const known = key ? this.customerIdByKey.get(key) : undefined;
      if (known) return { id: known };
      this.customersCreated.push({ params, idempotencyKey: key });
      const id = `cus_test_${++this.customerCount}`;
      if (key) this.customerIdByKey.set(key, id);
      return { id };
    },
  };

  readonly checkout = {
    sessions: {
      create: async (params: Stripe.Checkout.SessionCreateParams) => {
        this.checkoutSessionsCreated.push(params);
        const id = `cs_test_${this.checkoutSessionsCreated.length}`;
        const session: FakeSession = {
          id,
          customer: params.customer as string,
          status: 'open',
          url: `https://checkout.stripe.test/${id}`,
        };
        this.sessions.push(session);
        return session;
      },
      list: async (params: Stripe.Checkout.SessionListParams) => ({
        data: this.sessions.filter(
          (session) => session.customer === params.customer && (!params.status || session.status === params.status),
        ),
      }),
      expire: async (id: string) => {
        const session = this.sessions.find((candidate) => candidate.id === id);
        if (!session || session.status !== 'open') throw new Error(`Session ${id} is not open`);
        session.status = 'expired';
        return session;
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
    /** Answers with the subscription as it stood when asked, after any delay queued in `retrieveDelays`. */
    retrieve: async (id: string) => {
      const subscription = this.subscriptionsById.get(id);
      if (!subscription) throw new Error(`No such subscription: '${id}'`);
      const snapshot = structuredClone(subscription);
      const delay = this.retrieveDelays.shift() ?? 0;
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      return snapshot;
    },
    list: async (params: Stripe.SubscriptionListParams) => ({
      data: [...this.subscriptionsById.values()].filter((subscription) => subscription.customer === params.customer),
    }),
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
        data: [
          {
            id: `si_${input.id}`,
            current_period_end: input.currentPeriodEnd ?? nowSeconds() + 30 * 86_400,
            price,
          },
        ],
      },
    };
    this.subscriptionsById.set(input.id, subscription);
    return subscription as unknown as Stripe.Subscription;
  }

  /** Test convenience: an unfinished Checkout page, as a coiffeur who opened a second tab leaves behind. */
  openSessionFor(customer: string): string {
    const id = `cs_open_${this.sessions.length + 1}`;
    this.sessions.push({ id, customer, status: 'open', url: `https://checkout.stripe.test/${id}` });
    return id;
  }

  sessionStatus(id: string): FakeSession['status'] | undefined {
    return this.sessions.find((session) => session.id === id)?.status;
  }
}
