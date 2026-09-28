import { BadRequestException, Injectable, InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import { EnvironmentVariables } from '../config/env.validation';
import { SupabaseService } from '../database/supabase.service';
import { StripeService } from '../stripe/stripe.service';

/**
 * none: no Stripe account yet · incomplete: onboarding unfinished ·
 * ready: payouts enabled · exempt: the demo salon, bookable without one.
 */
export type PayoutState = 'none' | 'incomplete' | 'ready' | 'exempt';

export interface PayoutStatus {
  state: PayoutState;
  /** Clients can book and pay this salon in the app. */
  onlineBooking: boolean;
  /** Stripe's Express dashboard (payouts, bank details) can open. */
  canOpenDashboard: boolean;
}

interface PayoutAccountRow {
  profile_id: string;
  stripe_account_id: string | null;
  details_submitted: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  bookable_without_payouts: boolean;
}

/** Beauty and barber shops, for Stripe's risk checks and statements. */
const SALON_MCC = '7230';

function toStatus(row: PayoutAccountRow | null): PayoutStatus {
  const ready = Boolean(row?.stripe_account_id && row.payouts_enabled);
  const state: PayoutState = ready
    ? 'ready'
    : row?.stripe_account_id
      ? 'incomplete'
      : row?.bookable_without_payouts
        ? 'exempt'
        : 'none';
  return {
    state,
    onlineBooking: ready || Boolean(row?.bookable_without_payouts),
    canOpenDashboard: Boolean(row?.stripe_account_id && row.details_submitted),
  };
}

/**
 * Where a salon gets paid (TODO.md Phase 5): a Stripe Connect Express
 * account the coiffeur fills in on Stripe's own pages — identity, bank
 * details — never here. WorldHair charges clients itself and transfers each
 * salon its share, so the account only needs Stripe's `transfers`
 * capability. A salon takes online bookings once its payouts are on.
 */
@Injectable()
export class PayoutAccountsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /** Asks Stripe again while onboarding is unfinished: coming back from it shows the result at once, webhook or not. */
  async getStatus(profileId: string): Promise<PayoutStatus> {
    let row = await this.findRow(profileId);
    if (row?.stripe_account_id && !row.payouts_enabled) {
      await this.syncAccount(await this.stripe.client.accounts.retrieve(row.stripe_account_id));
      row = await this.findRow(profileId);
    }
    return toStatus(row);
  }

  async isBookable(profileId: string): Promise<boolean> {
    return toStatus(await this.findRow(profileId)).onlineBooking;
  }

  /** The account a transfer can go to — none while payouts are off (the demo salon's money stays with WorldHair). */
  async readyAccountId(profileId: string): Promise<string | null> {
    const row = await this.findRow(profileId);
    return row?.stripe_account_id && row.payouts_enabled ? row.stripe_account_id : null;
  }

  async createOnboardingLink(profileId: string): Promise<{ url: string }> {
    const back = this.returnPage();
    const accountId = await this.ensureAccount(profileId);
    const link = await this.stripe.client.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      return_url: `${back}?etat=termine`,
      refresh_url: `${back}?etat=expire`,
    });
    return { url: link.url };
  }

  async createDashboardLink(profileId: string): Promise<{ url: string }> {
    const row = await this.findRow(profileId);
    if (!row?.stripe_account_id || !row.details_submitted) {
      throw new BadRequestException('Finish setting up payouts first');
    }
    const link = await this.stripe.client.accounts.createLoginLink(row.stripe_account_id);
    return { url: link.url };
  }

  /** From `account.updated` (Connect webhook), or a fresh read. */
  async syncAccount(account: Stripe.Account): Promise<void> {
    const { error } = await this.supabase.client
      .from('coiffeur_payout_accounts')
      .update({
        details_submitted: account.details_submitted,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
      })
      .eq('stripe_account_id', account.id);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  private async ensureAccount(profileId: string): Promise<string> {
    const row = await this.findRow(profileId);
    if (row?.stripe_account_id) return row.stripe_account_id;

    const [email, salonName] = await Promise.all([this.emailOf(profileId), this.salonNameOf(profileId)]);
    // Two taps racing get the same account back: Stripe replays a repeated idempotency key.
    const account = await this.stripe.client.accounts.create(
      {
        type: 'express',
        country: 'FR',
        ...(email ? { email } : {}),
        capabilities: { transfers: { requested: true } },
        business_profile: { mcc: SALON_MCC, ...(salonName ? { name: salonName } : {}) },
        metadata: { profile_id: profileId },
      },
      { idempotencyKey: `worldhair-connect-${profileId}` },
    );
    const { error } = await this.supabase.client
      .from('coiffeur_payout_accounts')
      .upsert({ profile_id: profileId, stripe_account_id: account.id }, { onConflict: 'profile_id' });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return account.id;
  }

  /** The website page Stripe's onboarding comes back to; it hands over to the app. */
  private returnPage(): string {
    const base = (this.config.get('WEB_APP_URL', { infer: true }) ?? '').trim().replace(/\/+$/, '');
    if (!base) {
      throw new ServiceUnavailableException('WEB_APP_URL is not configured');
    }
    return `${base}/connect/retour`;
  }

  private async findRow(profileId: string): Promise<PayoutAccountRow | null> {
    const { data, error } = await this.supabase.client
      .from('coiffeur_payout_accounts')
      .select()
      .eq('profile_id', profileId)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data as PayoutAccountRow | null;
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
}
