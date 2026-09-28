import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import type Stripe from 'stripe';
import { CoiffeurApplicationsService } from '../coiffeur/coiffeur-applications.service';
import { subscriptionPageUrl } from '../common/utils/web-links';
import { EnvironmentVariables } from '../config/env.validation';
import { SupabaseService } from '../database/supabase.service';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { StripeService } from '../stripe/stripe.service';
import { PLAN_LOOKUP_KEYS, PORTAL_CONFIGURATION_APP } from './stripe-catalog';
import { SubscriptionNotifier } from './subscription-notifier';
import {
  isListed,
  isLiveStatus,
  StripeSubscriptionStatus,
  SubscriptionPlan,
  SubscriptionRow,
  subscriptionEndsAt,
  SubscriptionState,
  subscriptionState,
} from './subscription-state';

/** The coiffeur's own view — the app's "Abonnement" tab and the website's "Mon abonnement". */
export interface SubscriptionView {
  state: SubscriptionState;
  plan: SubscriptionPlan;
  /** Visible in search and bookable right now. */
  listed: boolean;
  /** Offered without Stripe (seeded demo salons, launch partners). */
  offered: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  /** When the salon stops being listed if nothing changes; `null` while it renews on its own. */
  endsAt: string | null;
  /** Stripe's Customer Portal can open: plan, card, invoices, cancellation. */
  canManage: boolean;
  /** The admin hasn't validated the application yet: nothing to subscribe to until then. */
  awaitingValidation: boolean;
  /** A Checkout can start: validated, and no live Stripe subscription yet. */
  canSubscribe: boolean;
  /** Free days that Checkout would start with: only a first subscription gets them, and an offered period is kept whole. */
  trialDays: number;
}

export interface PlanPrice {
  plan: SubscriptionPlan;
  /** Euros, TTC. */
  amount: number;
  currency: string;
}

export interface AdminSubscriptionSummary {
  profileId: string;
  firstName: string;
  lastName: string;
  email: string;
  plan: SubscriptionPlan;
  state: SubscriptionState;
  /** Stripe's own status; `null` for an offered subscription or none at all. */
  stripeStatus: StripeSubscriptionStatus | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  endsAt: string | null;
  stripeCustomerUrl: string | null;
}

interface ProfileRow {
  id: string;
  first_name: string;
  last_name: string;
}

interface PriceBook {
  fetchedAt: number;
  prices: PlanPrice[];
  ids: Record<SubscriptionPlan, string>;
}

const PRICE_CACHE_MS = 10 * 60_000;
const DAY_MS = 86_400_000;
/** Checkout refuses a `trial_end` closer than 48 hours. */
const MIN_TRIAL_END_MS = 48 * 60 * 60_000;
/** Stripe statuses that still bill or can bill again — a second subscription beside one of these is a double charge. */
const OPEN_STRIPE_STATUSES: Stripe.Subscription.Status[] = ['trialing', 'active', 'past_due', 'unpaid', 'paused'];

function idOf(value: string | { id: string }): string {
  return typeof value === 'string' ? value : value.id;
}

function isoFromSeconds(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

const STRIPE_STATUSES: StripeSubscriptionStatus[] = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
  'incomplete_expired',
  'paused',
];

/** A status newer than this code never lists a salon by accident: it reads as paused until taught here. */
function knownStatus(status: Stripe.Subscription.Status): StripeSubscriptionStatus {
  return STRIPE_STATUSES.includes(status as StripeSubscriptionStatus) ? (status as StripeSubscriptionStatus) : 'paused';
}

function planOf(price: Stripe.Price | undefined): SubscriptionPlan {
  return price?.lookup_key === PLAN_LOOKUP_KEYS.yearly || price?.recurring?.interval === 'year' ? 'yearly' : 'monthly';
}

/**
 * Coiffeur subscriptions (devis: "Abonnement professionnel Stripe", TODO.md
 * Phase 4). Sold on the website only: Stripe Checkout starts one, Stripe's
 * Customer Portal changes the plan or the card, shows invoices and cancels.
 * Stripe's webhooks keep `coiffeur_subscriptions` in step, and that row
 * decides whether the salon is listed (subscription-state.ts). No card
 * number ever reaches this server.
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private priceBookCache: PriceBook | null = null;
  private portalConfigurationId_: string | null = null;
  /** One sync at a time per Stripe subscription (see `serialized`). */
  private readonly syncQueues = new Map<string, Promise<unknown>>();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly applications: CoiffeurApplicationsService,
    private readonly stripe: StripeService,
    private readonly settings: PlatformSettingsService,
    private readonly notifier: SubscriptionNotifier,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async getMine(profileId: string): Promise<SubscriptionView> {
    const [row, settings, application] = await Promise.all([
      this.findRow(profileId),
      this.settings.get(),
      this.applications.getMine(profileId),
    ]);
    const now = new Date();
    const validated = application?.status === 'validated';
    const trial = this.trialFor(row, settings.trialDays, now);
    return {
      state: subscriptionState(row, now),
      plan: row?.plan ?? 'monthly',
      // What search shows: the subscription, and a salon page complete in the app.
      listed: isListed(row, now) && validated && Boolean(application?.shopProfileComplete),
      offered: row !== null && row.status !== 'none' && row.stripe_subscription_id === null,
      trialEndsAt: row?.trial_ends_at ?? null,
      currentPeriodEnd: row?.current_period_end ?? null,
      endsAt: subscriptionEndsAt(row, now),
      canManage: Boolean(row?.stripe_customer_id && row.stripe_subscription_id),
      awaitingValidation: !validated,
      canSubscribe: validated && !this.hasLiveStripeSubscription(row),
      trialDays:
        trial.trial_period_days ??
        (trial.trial_end ? Math.ceil((trial.trial_end * 1000 - now.getTime()) / DAY_MS) : 0),
    };
  }

  async listPrices(): Promise<PlanPrice[]> {
    return (await this.priceBook()).prices;
  }

  async createCheckoutSession(profileId: string, plan: SubscriptionPlan): Promise<{ url: string }> {
    // Paying before the admin's validation would charge for a salon that can't be listed.
    if (!(await this.isValidated(profileId))) {
      throw new ForbiddenException('The application must be validated before subscribing');
    }
    const row = await this.findRow(profileId);
    if (this.hasLiveStripeSubscription(row)) {
      throw new BadRequestException('Already subscribed: change it from the customer portal');
    }
    const pageUrl = this.pageUrl();
    const [book, settings] = await Promise.all([this.priceBook(), this.settings.get()]);
    const customer = await this.ensureCustomer(profileId, row);
    await this.assertNothingToBillYet(customer);

    const session = await this.stripe.client.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: profileId,
      line_items: [{ price: book.ids[plan], quantity: 1 }],
      subscription_data: {
        metadata: { profile_id: profileId },
        ...this.trialFor(row, settings.trialDays, new Date()),
      },
      success_url: `${pageUrl}?checkout=success`,
      cancel_url: `${pageUrl}?checkout=cancel`,
      locale: 'fr',
      allow_promotion_codes: true,
    });
    if (!session.url) {
      throw new InternalServerErrorException('Stripe returned no Checkout URL');
    }
    return { url: session.url };
  }

  /**
   * The row lags Stripe by a webhook, so Stripe itself is asked: no second
   * subscription beside one that still bills. Any other Checkout page left
   * open (a second tab) is closed first — only one can ever be paid.
   */
  private async assertNothingToBillYet(customer: string): Promise<void> {
    const { data: subscriptions } = await this.stripe.client.subscriptions.list({ customer, status: 'all', limit: 20 });
    if (subscriptions.some((subscription) => OPEN_STRIPE_STATUSES.includes(subscription.status))) {
      throw new BadRequestException('Already subscribed: change it from the customer portal');
    }
    const { data: sessions } = await this.stripe.client.checkout.sessions.list({ customer, status: 'open', limit: 20 });
    for (const session of sessions) {
      await this.stripe.client.checkout.sessions.expire(session.id);
    }
  }

  /**
   * One free trial per coiffeur: a returning subscriber pays from day one.
   * An offered period still running is kept whole — the first charge waits
   * for the later of its end and the admin's trial.
   */
  private trialFor(
    row: SubscriptionRow | null,
    trialDays: number,
    now: Date,
  ): { trial_period_days?: number; trial_end?: number } {
    if (row?.stripe_subscription_id) return {};
    const offeredEnd =
      row && isListed(row, now) && row.current_period_end ? new Date(row.current_period_end).getTime() : null;
    const byDays = trialDays > 0 ? { trial_period_days: trialDays } : {};
    if (offeredEnd === null) return byDays;
    const end = Math.max(offeredEnd, now.getTime() + trialDays * DAY_MS);
    return end >= now.getTime() + MIN_TRIAL_END_MS ? { trial_end: Math.floor(end / 1000) } : byDays;
  }

  async createPortalSession(profileId: string): Promise<{ url: string }> {
    const row = await this.findRow(profileId);
    if (!row?.stripe_customer_id) {
      throw new BadRequestException('No subscription to manage yet');
    }
    const returnUrl = this.pageUrl();
    const configuration = await this.portalConfigurationId();
    const session = await this.stripe.client.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: returnUrl,
      ...(configuration ? { configuration } : {}),
    });
    return { url: session.url };
  }

  /**
   * Every event only says "look again": the subscription is fetched fresh
   * from Stripe before it's written, so events arriving late, twice or out
   * of order all end on Stripe's current state.
   */
  async handleStripeEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.subscription) {
          await this.syncSubscription(idOf(session.subscription));
        }
        return;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
        await this.syncSubscription(event.data.object.id);
        return;
      case 'customer.subscription.trial_will_end': {
        const synced = await this.syncSubscription(event.data.object.id);
        if (synced?.trial_ends_at) {
          await this.notifier.trialEnding(synced.profile_id, synced.trial_ends_at);
        }
        return;
      }
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        // Endpoints on an API version before 2025-03-31 still send `invoice.subscription`.
        const legacy = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription;
        const subscription = invoice.parent?.subscription_details?.subscription ?? legacy;
        if (!subscription) return;
        const synced = await this.syncSubscription(idOf(subscription));
        if (synced && event.type === 'invoice.payment_failed') {
          await this.notifier.paymentFailed(synced.profile_id, `${invoice.id}:${invoice.attempt_count}`);
        }
        return;
      }
      default:
        return;
    }
  }

  /**
   * A banned coiffeur stops paying at once; a suspended one pauses (Stripe
   * voids the invoices meanwhile) and resumes on reactivation. Offered
   * subscriptions and ended ones have nothing to stop.
   */
  @OnEvent('account.status_changed')
  async onAccountStatusChanged(change: {
    profileId: string;
    role: string;
    previousStatus: string;
    status: string;
  }): Promise<void> {
    if (change.role !== 'coiffeur' || change.status === change.previousStatus) return;
    const row = await this.findRow(change.profileId);
    if (!row?.stripe_subscription_id || !isLiveStatus(row.status)) return;

    if (change.status === 'banned') {
      await this.stripe.client.subscriptions.cancel(row.stripe_subscription_id);
    } else if (change.status === 'suspended') {
      await this.stripe.client.subscriptions.update(row.stripe_subscription_id, {
        pause_collection: { behavior: 'void' },
      });
    } else if (change.status === 'active' && change.previousStatus === 'suspended') {
      await this.stripe.client.subscriptions.update(row.stripe_subscription_id, { pause_collection: '' });
    }
  }

  async listAllForAdmin(): Promise<AdminSubscriptionSummary[]> {
    const { data: profiles, error: profilesError } = await this.supabase.client
      .from('profiles')
      .select()
      .eq('role', 'coiffeur');
    if (profilesError) {
      throw new InternalServerErrorException(profilesError.message);
    }
    const { data: subs, error: subsError } = await this.supabase.client.from('coiffeur_subscriptions').select();
    if (subsError) {
      throw new InternalServerErrorException(subsError.message);
    }

    const profileRows = profiles as ProfileRow[];
    const subByProfileId = new Map((subs as SubscriptionRow[]).map((row) => [row.profile_id, row]));
    const emailById = await this.emailsById(profileRows.map((row) => row.id));
    const now = new Date();

    return profileRows.map((profile) => {
      const row = subByProfileId.get(profile.id) ?? null;
      return {
        profileId: profile.id,
        firstName: profile.first_name,
        lastName: profile.last_name,
        email: emailById.get(profile.id) ?? '',
        plan: row?.plan ?? 'monthly',
        state: subscriptionState(row, now),
        stripeStatus: row?.stripe_subscription_id ? row.status : null,
        trialEndsAt: row?.trial_ends_at ?? null,
        currentPeriodEnd: row?.current_period_end ?? null,
        endsAt: subscriptionEndsAt(row, now),
        stripeCustomerUrl: row?.stripe_customer_id ? this.stripe.dashboardUrl(`customers/${row.stripe_customer_id}`) : null,
      };
    });
  }

  // ─── Stripe → coiffeur_subscriptions ────────────────────────────────────

  private syncSubscription(subscriptionId: string): Promise<SubscriptionRow | null> {
    return this.serialized(subscriptionId, () => this.syncNow(subscriptionId));
  }

  /**
   * Stripe may deliver two events about one subscription at once. Run
   * alone, each sync reads Stripe after the previous one wrote, so an older
   * snapshot can't be written last. (One server instance: an in-process
   * queue is enough.)
   */
  private serialized<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.syncQueues.get(key) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(task);
    const tail = run.catch(() => undefined);
    this.syncQueues.set(key, tail);
    void tail.then(() => {
      if (this.syncQueues.get(key) === tail) this.syncQueues.delete(key);
    });
    return run;
  }

  private async syncNow(subscriptionId: string): Promise<SubscriptionRow | null> {
    const subscription = await this.stripe.client.subscriptions.retrieve(subscriptionId);
    const customerId = idOf(subscription.customer);
    // Only what WorldHair itself wrote into Stripe says whose it is: the metadata our
    // Checkout sets, or the customer our server created. Never a client_reference_id,
    // which anyone with a Payment Link could fill in.
    const profileId = subscription.metadata?.profile_id || (await this.profileIdForCustomer(customerId));
    if (!profileId) {
      this.logger.warn(`Stripe subscription ${subscription.id} matches no coiffeur — ignored`);
      return null;
    }
    // Its coiffeur deleted their account (TODO.md Phase 8): Stripe's last news about it has nowhere to go.
    if (!(await this.profileExists(profileId))) return null;

    const status = knownStatus(subscription.status);
    const before = await this.findRow(profileId);
    if (before?.stripe_subscription_id && before.stripe_subscription_id !== subscription.id && isLiveStatus(before.status)) {
      // An abandoned attempt (an incomplete Checkout expiring, say) never overwrites the live subscription.
      if (!isLiveStatus(status)) return before;
      // Two live ones would bill twice: keep the first, flag the other for a refund from Stripe's dashboard.
      this.logger.error(
        `Coiffeur ${profileId} has a second live Stripe subscription ${subscription.id} beside ${before.stripe_subscription_id}: cancel and refund it in Stripe`,
      );
      return before;
    }

    const item = subscription.items.data[0];
    const periodEnd = isoFromSeconds(item?.current_period_end);
    const next: SubscriptionRow = {
      profile_id: profileId,
      plan: planOf(item?.price),
      status,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      trial_ends_at: isoFromSeconds(subscription.trial_end),
      current_period_end: periodEnd,
      cancel_at: isoFromSeconds(subscription.cancel_at) ?? (subscription.cancel_at_period_end ? periodEnd : null),
    };
    await this.upsertRow(next);

    if (isListed(before) && !isListed(next)) {
      await this.notifier.ended(profileId, `${subscription.id}:${status}`);
    }
    return next;
  }

  /**
   * The coiffeur deleted their account (TODO.md Phase 8): Stripe forgets
   * them — their customer deleted, which ends any subscription at once. The
   * invoices stay with Stripe, for the accounts. One Stripe no longer has is
   * gone already.
   */
  async endForDeletion(profileId: string): Promise<void> {
    const row = await this.findRow(profileId);
    if (!row?.stripe_customer_id) return;
    try {
      await this.stripe.client.customers.del(row.stripe_customer_id);
    } catch (err) {
      if ((err as { code?: string }).code === 'resource_missing') return;
      this.logger.error(`Couldn't delete Stripe customer ${row.stripe_customer_id}`, err as Error);
      throw new ServiceUnavailableException("The subscription couldn't be ended: try again in a few minutes");
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async profileExists(profileId: string): Promise<boolean> {
    const { data, error } = await this.supabase.client.from('profiles').select('id').eq('id', profileId).maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data !== null;
  }

  private async isValidated(profileId: string): Promise<boolean> {
    return (await this.applications.getMine(profileId))?.status === 'validated';
  }

  private hasLiveStripeSubscription(row: SubscriptionRow | null): boolean {
    return Boolean(row?.stripe_subscription_id) && isLiveStatus(row!.status);
  }

  private pageUrl(): string {
    const url = subscriptionPageUrl(this.config.get('WEB_APP_URL', { infer: true }));
    if (!url) {
      throw new ServiceUnavailableException('WEB_APP_URL is not configured');
    }
    return url;
  }

  private async priceBook(): Promise<PriceBook> {
    if (this.priceBookCache && Date.now() - this.priceBookCache.fetchedAt < PRICE_CACHE_MS) {
      return this.priceBookCache;
    }
    const { data } = await this.stripe.client.prices.list({
      lookup_keys: Object.values(PLAN_LOOKUP_KEYS),
      active: true,
    });
    const find = (plan: SubscriptionPlan) => data.find((price) => price.lookup_key === PLAN_LOOKUP_KEYS[plan]);
    const monthly = find('monthly');
    const yearly = find('yearly');
    if (!monthly || !yearly) {
      throw new ServiceUnavailableException('Stripe prices are missing: run `bun run stripe:setup`');
    }
    const toPlanPrice = (plan: SubscriptionPlan, price: Stripe.Price): PlanPrice => ({
      plan,
      amount: (price.unit_amount ?? 0) / 100,
      currency: price.currency,
    });
    this.priceBookCache = {
      fetchedAt: Date.now(),
      prices: [toPlanPrice('monthly', monthly), toPlanPrice('yearly', yearly)],
      ids: { monthly: monthly.id, yearly: yearly.id },
    };
    return this.priceBookCache;
  }

  /**
   * The portal settings the setup script created; Stripe's default ones
   * otherwise. Only a hit is remembered: the script may run after boot.
   */
  private async portalConfigurationId(): Promise<string | undefined> {
    if (this.portalConfigurationId_) return this.portalConfigurationId_;
    const { data } = await this.stripe.client.billingPortal.configurations.list({ active: true, limit: 100 });
    const found = data.find((configuration) => configuration.metadata?.app === PORTAL_CONFIGURATION_APP)?.id;
    if (found) this.portalConfigurationId_ = found;
    return found;
  }

  private async ensureCustomer(profileId: string, row: SubscriptionRow | null): Promise<string> {
    if (row?.stripe_customer_id) return row.stripe_customer_id;

    const [email, salonName] = await Promise.all([this.emailOf(profileId), this.salonNameOf(profileId)]);
    // Two clicks racing get the same customer back: Stripe replays a repeated idempotency key.
    const customer = await this.stripe.client.customers.create(
      {
        ...(email ? { email } : {}),
        ...(salonName ? { name: salonName } : {}),
        preferred_locales: ['fr'],
        metadata: { profile_id: profileId },
      },
      { idempotencyKey: `worldhair-customer-${profileId}` },
    );
    await this.upsertRow({ profile_id: profileId, stripe_customer_id: customer.id });
    return customer.id;
  }

  private async findRow(profileId: string): Promise<SubscriptionRow | null> {
    const { data, error } = await this.supabase.client
      .from('coiffeur_subscriptions')
      .select()
      .eq('profile_id', profileId)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data as SubscriptionRow | null;
  }

  private async profileIdForCustomer(customerId: string): Promise<string | null> {
    const { data, error } = await this.supabase.client
      .from('coiffeur_subscriptions')
      .select()
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data as SubscriptionRow | null)?.profile_id ?? null;
  }

  private async upsertRow(row: Partial<SubscriptionRow> & { profile_id: string }): Promise<void> {
    const { error } = await this.supabase.client
      .from('coiffeur_subscriptions')
      .upsert(row, { onConflict: 'profile_id' });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  private async emailOf(profileId: string): Promise<string | null> {
    const {
      data: { user },
      error,
    } = await this.supabase.client.auth.admin.getUserById(profileId);
    return error ? null : (user?.email ?? null);
  }

  private async salonNameOf(profileId: string): Promise<string | null> {
    const { data } = await this.supabase.client
      .from('coiffeur_profiles')
      .select('salon_name')
      .eq('profile_id', profileId)
      .maybeSingle();
    return (data as { salon_name: string } | null)?.salon_name || null;
  }

  /** Same paginated lookup as AdminAccountsService.emailsById — no bulk-by-id lookup in supabase-js. */
  private async emailsById(ids: string[]): Promise<Map<string, string>> {
    const wanted = new Set(ids);
    const result = new Map<string, string>();
    let page = 1;
    for (;;) {
      const { data, error } = await this.supabase.client.auth.admin.listUsers({ page, perPage: 200 });
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
      for (const user of data.users) {
        if (wanted.has(user.id)) {
          result.set(user.id, user.email ?? '');
        }
      }
      if (data.users.length < 200 || result.size === wanted.size) {
        return result;
      }
      page += 1;
    }
  }
}
