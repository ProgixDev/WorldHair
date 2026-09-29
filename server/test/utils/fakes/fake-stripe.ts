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
  customer: string | null;
  status: 'open' | 'complete' | 'expired';
  url: string;
  mode?: string;
  payment_status?: 'paid' | 'unpaid';
  payment_intent?: string | null;
  /** Payment mode: cents, and what the PaymentIntent gets once the client pays (`completeCheckout`). */
  amount_total?: number;
  paymentIntentData?: Stripe.Checkout.SessionCreateParams.PaymentIntentData;
}

interface FakeTransfer {
  id: string;
  /** Cents, like Stripe. */
  amount: number;
  amount_reversed: number;
  transfer_group: string | null;
  created: number;
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
  /** Each created session's idempotency key, in the same order. */
  readonly checkoutIdempotencyKeys: (string | undefined)[] = [];
  readonly portalSessionsCreated: Stripe.BillingPortal.SessionCreateParams[] = [];
  /** Set to [] to play a Stripe account where the setup script was never run. */
  prices_: typeof PRICES = PRICES;
  portalConfigurations: { id: string; metadata: Record<string, string> }[] = [];
  /** Milliseconds each coming `subscriptions.retrieve` waits before answering, in call order. */
  retrieveDelays: number[] = [];
  /** What was asked of `subscriptions.cancel` / `subscriptions.update`, in order. */
  readonly subscriptionCalls: { id: string; call: 'cancel' | 'update'; params?: unknown }[] = [];
  private readonly subscriptionsById = new Map<string, Record<string, unknown>>();
  private readonly customerIdByKey = new Map<string, string>();
  private readonly sessions: FakeSession[] = [];
  private readonly sessionIdByKey = new Map<string, string>();
  private customerCount = 0;
  /** Customers deleted (`customers.del`), in order. */
  readonly customersDeleted: string[] = [];
  /** Customers Stripe doesn't know (deleted from its dashboard, say): deleting them answers `resource_missing`. */
  private readonly missingCustomers = new Set<string>();
  private nextTransferError: string | null = null;

  /** Test convenience: a customer Stripe no longer has. */
  forgetCustomer(id: string): void {
    this.missingCustomers.add(id);
  }

  /** Test convenience: the next transfer fails, as when Stripe is down. */
  failNextTransfer(message = 'Stripe is unavailable'): void {
    this.nextTransferError = message;
  }

  readonly customers = {
    /** A deleted customer still answers, marked `deleted`. */
    retrieve: async (id: string) =>
      this.customersDeleted.includes(id) || this.missingCustomers.has(id) ? { id, object: 'customer', deleted: true } : { id, object: 'customer' },
    /** Like Stripe: the customer goes, and any subscription of theirs ends at once. */
    del: async (id: string) => {
      if (this.missingCustomers.has(id)) {
        throw Object.assign(new Error(`No such customer: '${id}'`), { code: 'resource_missing', statusCode: 404 });
      }
      this.customersDeleted.push(id);
      for (const subscription of this.subscriptionsById.values()) {
        if (subscription.customer === id) subscription.status = 'canceled';
      }
      return { id, deleted: true };
    },
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
      /** Like Stripe, a repeated idempotency key answers with the session the first call made. */
      create: async (params: Stripe.Checkout.SessionCreateParams, options?: Stripe.RequestOptions) => {
        const key = options?.idempotencyKey;
        const known = key ? this.sessions.find((session) => session.id === this.sessionIdByKey.get(key)) : undefined;
        if (known) return structuredClone(known);
        this.checkoutSessionsCreated.push(params);
        this.checkoutIdempotencyKeys.push(key);
        const id = `cs_test_${this.checkoutSessionsCreated.length}`;
        const session: FakeSession = {
          id,
          customer: (params.customer as string | undefined) ?? null,
          status: 'open',
          url: `https://checkout.stripe.test/${id}`,
          mode: params.mode,
          ...(params.mode === 'payment'
            ? {
                payment_status: 'unpaid' as const,
                payment_intent: null,
                amount_total: (params.line_items ?? []).reduce(
                  (sum, item) => sum + (item.price_data?.unit_amount ?? 0) * (item.quantity ?? 1),
                  0,
                ),
                paymentIntentData: params.payment_intent_data,
              }
            : {}),
        };
        this.sessions.push(session);
        if (key) this.sessionIdByKey.set(key, id);
        return structuredClone(session);
      },
      retrieve: async (id: string) => {
        const session = this.sessions.find((candidate) => candidate.id === id);
        if (!session) throw new Error(`No such checkout.session: '${id}'`);
        return structuredClone(session);
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
    cancel: async (id: string) => {
      this.subscriptionCalls.push({ id, call: 'cancel' });
      const subscription = this.subscriptionsById.get(id);
      if (subscription) subscription.status = 'canceled';
      return subscription;
    },
    update: async (id: string, params: Stripe.SubscriptionUpdateParams) => {
      this.subscriptionCalls.push({ id, call: 'update', params });
      return this.subscriptionsById.get(id);
    },
  };

  // ─── Payments (TODO.md Phase 5) ─────────────────────────────────────────

  /** PaymentIntents Stripe's pages made when clients paid (`completeCheckout`). */
  readonly paymentIntentsCreated: { params: Stripe.PaymentIntentCreateParams }[] = [];
  /** Refunds that moved money — a replayed idempotency key adds none, like Stripe. */
  readonly refundsCreated: { params: Stripe.RefundCreateParams; idempotencyKey?: string }[] = [];
  readonly transfersCreated: { params: Stripe.TransferCreateParams; idempotencyKey?: string }[] = [];
  readonly reversalsCreated: { transferId: string; params?: Stripe.TransferCreateReversalParams }[] = [];
  readonly accountsCreated: { params: Stripe.AccountCreateParams; idempotencyKey?: string }[] = [];
  readonly accountLinksCreated: Stripe.AccountLinkCreateParams[] = [];
  private readonly intents = new Map<string, Record<string, unknown>>();
  private readonly accountsById = new Map<string, Record<string, unknown>>();
  private readonly accountIdByKey = new Map<string, string>();
  private readonly refundIdByKey = new Map<string, { id: string; amount: number }>();
  /** Cents refunded so far on each PaymentIntent: what its charge's `amount_refunded` says. */
  private readonly refundedCents = new Map<string, number>();
  private readonly intentIdByCharge = new Map<string, string>();
  private nextRefundError: string | null = null;
  private readonly transfersById = new Map<string, FakeTransfer>();
  private readonly transferIdByKey = new Map<string, string>();
  private readonly reversalIdByKey = new Map<string, string>();

  readonly paymentIntents = {
    retrieve: async (id: string) => {
      const intent = this.intents.get(id);
      if (!intent) throw new Error(`No such payment_intent: '${id}'`);
      return structuredClone(intent);
    },
  };

  /**
   * Test convenience: the client paid on Stripe's page — its PaymentIntent,
   * carrying the session's `payment_intent_data`, succeeded. Answers it, as
   * `payment_intent.succeeded` would carry it.
   */
  completeCheckout(sessionId: string): Record<string, unknown> {
    const session = this.sessions.find((candidate) => candidate.id === sessionId);
    if (!session || session.status !== 'open') throw new Error(`Session ${sessionId} is not open`);
    const data = session.paymentIntentData ?? {};
    this.paymentIntentsCreated.push({
      params: { ...data, amount: session.amount_total ?? 0, currency: 'eur' } as Stripe.PaymentIntentCreateParams,
    });
    const id = `pi_test_${this.paymentIntentsCreated.length}`;
    const intent = {
      id,
      object: 'payment_intent',
      amount: session.amount_total ?? 0,
      currency: 'eur',
      status: 'succeeded',
      latest_charge: `ch_${id}`,
      metadata: data.metadata ?? {},
    };
    this.intents.set(id, intent);
    this.intentIdByCharge.set(`ch_${id}`, id);
    session.status = 'complete';
    session.payment_status = 'paid';
    session.payment_intent = id;
    return structuredClone(intent);
  }

  readonly refunds = {
    /** Like Stripe, a repeated idempotency key answers with the first refund: no money moves twice. */
    create: async (params: Stripe.RefundCreateParams, options?: Stripe.RequestOptions) => {
      const key = options?.idempotencyKey;
      const known = key ? this.refundIdByKey.get(key) : undefined;
      if (known) return { ...known, status: 'succeeded' };
      if (this.nextRefundError) {
        const message = this.nextRefundError;
        this.nextRefundError = null;
        throw new Error(message);
      }
      this.refundsCreated.push({ params, idempotencyKey: key });
      const intentId = params.payment_intent as string;
      const refundedSoFar = this.refundedCents.get(intentId) ?? 0;
      const amount = params.amount ?? Number(this.intents.get(intentId)?.amount ?? 0) - refundedSoFar;
      this.refundedCents.set(intentId, refundedSoFar + amount);
      const refund = { id: `re_test_${this.refundsCreated.length}`, amount };
      if (key) this.refundIdByKey.set(key, refund);
      return { ...refund, status: 'succeeded' };
    },
  };

  /** Test convenience: the next refund fails, as when Stripe is down. */
  failNextRefund(message = 'Stripe is unavailable'): void {
    this.nextRefundError = message;
  }

  readonly charges = {
    /** Every refund counts, those made from Stripe's dashboard included (see `putCharge`). */
    retrieve: async (id: string) => {
      const intentId = this.intentIdByCharge.get(id) ?? null;
      return {
        id,
        object: 'charge',
        payment_intent: intentId,
        amount_refunded: intentId ? (this.refundedCents.get(intentId) ?? 0) : 0,
      };
    },
  };

  /** Test convenience: a charge Stripe knows, and what was already refunded on it (from Stripe's dashboard, say). */
  putCharge(charge: { id: string; paymentIntent: string; amountRefunded?: number }): void {
    this.intentIdByCharge.set(charge.id, charge.paymentIntent);
    if (charge.amountRefunded !== undefined) this.refundedCents.set(charge.paymentIntent, charge.amountRefunded);
  }

  readonly transfers = {
    /** Like Stripe, a repeated idempotency key answers with the first transfer. */
    create: async (params: Stripe.TransferCreateParams, options?: Stripe.RequestOptions) => {
      const key = options?.idempotencyKey;
      const known = key ? this.transferIdByKey.get(key) : undefined;
      if (known) return structuredClone(this.transfersById.get(known));
      if (this.nextTransferError) {
        const message = this.nextTransferError;
        this.nextTransferError = null;
        throw new Error(message);
      }
      this.transfersCreated.push({ params, idempotencyKey: key });
      const transfer: FakeTransfer = {
        id: `tr_test_${this.transfersCreated.length}`,
        amount: params.amount ?? 0,
        amount_reversed: 0,
        transfer_group: params.transfer_group ?? null,
        created: nowSeconds(),
      };
      this.transfersById.set(transfer.id, transfer);
      if (key) this.transferIdByKey.set(key, transfer.id);
      return structuredClone(transfer);
    },
    list: async (params: Stripe.TransferListParams) => ({
      data: [...this.transfersById.values()]
        .filter((transfer) => !params.transfer_group || transfer.transfer_group === params.transfer_group)
        .slice(0, params.limit ?? 10)
        .map((transfer) => structuredClone(transfer)),
    }),
    /** Like Stripe: never more back than the transfer sent (checked on the transfers this fake knows). */
    createReversal: async (
      transferId: string,
      params?: Stripe.TransferCreateReversalParams,
      options?: Stripe.RequestOptions,
    ) => {
      const key = options?.idempotencyKey;
      const known = key ? this.reversalIdByKey.get(key) : undefined;
      if (known) return { id: known };
      const transfer = this.transfersById.get(transferId);
      if (transfer) {
        const amount = params?.amount ?? transfer.amount - transfer.amount_reversed;
        if (transfer.amount_reversed + amount > transfer.amount) {
          throw new Error(`Amount ${amount} is more than the ${transfer.amount - transfer.amount_reversed} left on ${transferId}`);
        }
        transfer.amount_reversed += amount;
      }
      this.reversalsCreated.push({ transferId, params });
      const id = `trr_test_${this.reversalsCreated.length}`;
      if (key) this.reversalIdByKey.set(key, id);
      return { id };
    },
  };

  /** Test convenience: a transfer Stripe already holds — sent by an earlier run, say. */
  putTransfer(transfer: { id: string; amount: number; transferGroup: string }): void {
    this.transfersById.set(transfer.id, {
      id: transfer.id,
      amount: transfer.amount,
      amount_reversed: 0,
      transfer_group: transfer.transferGroup,
      created: nowSeconds(),
    });
  }

  readonly accounts = {
    create: async (params: Stripe.AccountCreateParams, options?: Stripe.RequestOptions) => {
      const key = options?.idempotencyKey;
      const known = key ? this.accountIdByKey.get(key) : undefined;
      if (known) return structuredClone(this.accountsById.get(known));
      this.accountsCreated.push({ params, idempotencyKey: key });
      const id = `acct_test_${this.accountsCreated.length}`;
      const account = { id, details_submitted: false, charges_enabled: false, payouts_enabled: false };
      this.accountsById.set(id, account);
      if (key) this.accountIdByKey.set(key, id);
      return structuredClone(account);
    },
    retrieve: async (id: string) => {
      const account = this.accountsById.get(id);
      if (!account) throw new Error(`No such account: '${id}'`);
      return structuredClone(account);
    },
    createLoginLink: async (id: string) => ({ url: `https://connect.stripe.test/express/${id}` }),
  };

  /** Test convenience: the salon finished (or not) Stripe's onboarding. */
  putAccount(account: { id: string; details_submitted: boolean; charges_enabled: boolean; payouts_enabled: boolean }): void {
    this.accountsById.set(account.id, { ...account });
  }

  readonly accountLinks = {
    create: async (params: Stripe.AccountLinkCreateParams) => {
      this.accountLinksCreated.push(params);
      return { url: `https://connect.stripe.test/setup/${params.account}` };
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
