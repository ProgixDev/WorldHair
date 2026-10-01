import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import { EnvironmentVariables } from '../config/env.validation';
import { SupabaseService } from '../database/supabase.service';
import { StripeService } from '../stripe/stripe.service';
import { FakeStripe } from '../../test/utils/fakes/fake-stripe';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { PayoutAccountsService } from './payout-accounts.service';

const COIFFEUR_ID = 'coiffeur-1';

function testConfig(): ConfigService<EnvironmentVariables, true> {
  const values: Record<string, unknown> = { STRIPE_SECRET_KEY: 'sk_test_123', WEB_APP_URL: 'https://worldhair.test' };
  return { get: (key: string) => values[key] } as unknown as ConfigService<EnvironmentVariables, true>;
}

describe('PayoutAccountsService', () => {
  let supabase: FakeSupabaseService;
  let stripe: FakeStripe;
  let payouts: PayoutAccountsService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    supabase.addUser('coiffeur-token', { id: COIFFEUR_ID, email: 'sofia@example.com', email_confirmed_at: null }, 'coiffeur');
    supabase.seedValidatedSalon({ profileId: COIFFEUR_ID, firstName: 'Sofia', lastName: 'Benali', salonName: 'Studio W', onlineBooking: false });
    stripe = new FakeStripe();
    const config = testConfig();
    payouts = new PayoutAccountsService(supabase as unknown as SupabaseService, new StripeService(stripe as unknown as Stripe, config), config);
  });

  it('starts without a Stripe account, so without online booking', async () => {
    await expect(payouts.getStatus(COIFFEUR_ID)).resolves.toMatchObject({ state: 'none', onlineBooking: false });
    await expect(payouts.isBookable(COIFFEUR_ID)).resolves.toBe(false);
  });

  it("creates the salon's Express account once, then an onboarding link that comes back to the website", async () => {
    const { url } = await payouts.createOnboardingLink(COIFFEUR_ID);
    await payouts.createOnboardingLink(COIFFEUR_ID);

    expect(url).toBe('https://connect.stripe.test/setup/acct_test_1');
    expect(stripe.accountsCreated).toHaveLength(1);
    expect(stripe.accountsCreated[0].params).toMatchObject({
      type: 'express',
      country: 'FR',
      email: 'sofia@example.com',
      capabilities: { transfers: { requested: true } },
      business_profile: { name: 'Studio W' },
      metadata: { profile_id: COIFFEUR_ID },
    });
    expect(stripe.accountsCreated[0].idempotencyKey).toMatch(new RegExp(`^worldhair-connect-${COIFFEUR_ID}-[0-9]+$`));
    expect(stripe.accountLinksCreated[0]).toMatchObject({
      account: 'acct_test_1',
      type: 'account_onboarding',
      return_url: 'https://worldhair.test/connect/retour?etat=termine',
      refresh_url: 'https://worldhair.test/connect/retour?etat=expire',
    });
    await expect(payouts.getStatus(COIFFEUR_ID)).resolves.toMatchObject({ state: 'incomplete', onlineBooking: false });
  });

  it("doesn't let a refused attempt block the salon: Stripe keeps a key's answer for a day, so the key only covers double taps", async () => {
    const now = jest.spyOn(Date, 'now');
    const tapAt = async (iso: string) => {
      now.mockReturnValue(Date.parse(iso));
      await payouts.createOnboardingLink(COIFFEUR_ID);
      // As if Stripe had refused it: nothing saved, the salon taps again.
      supabase.seedPayoutAccount({ profileId: COIFFEUR_ID, stripeAccountId: null });
    };

    await tapAt('2026-10-01T08:00:10Z');
    await tapAt('2026-10-01T08:00:50Z');
    expect(stripe.accountsCreated).toHaveLength(1); // same minute: the same request, replayed

    await tapAt('2026-10-01T08:01:05Z');
    now.mockRestore();
    expect(stripe.accountsCreated).toHaveLength(2); // a minute on: a new request, not the old answer
    expect(stripe.accountsCreated[1].idempotencyKey).not.toBe(stripe.accountsCreated[0].idempotencyKey);
  });

  it('asks Stripe again while onboarding is unfinished, and opens online booking once payouts are on', async () => {
    supabase.seedPayoutAccount({ profileId: COIFFEUR_ID, stripeAccountId: 'acct_1' });
    stripe.putAccount({ id: 'acct_1', details_submitted: true, charges_enabled: true, payouts_enabled: true });

    await expect(payouts.getStatus(COIFFEUR_ID)).resolves.toMatchObject({
      state: 'ready',
      onlineBooking: true,
      canOpenDashboard: true,
    });
    expect(supabase.payoutAccountFor(COIFFEUR_ID)).toMatchObject({ payouts_enabled: true, details_submitted: true });
    await expect(payouts.readyAccountId(COIFFEUR_ID)).resolves.toBe('acct_1');
  });

  it("keeps what Stripe's account.updated says", async () => {
    supabase.seedPayoutAccount({ profileId: COIFFEUR_ID, stripeAccountId: 'acct_1', payoutsEnabled: true, detailsSubmitted: true });

    await payouts.syncAccount({ id: 'acct_1', details_submitted: true, charges_enabled: false, payouts_enabled: false } as Stripe.Account);

    expect(supabase.payoutAccountFor(COIFFEUR_ID)).toMatchObject({ payouts_enabled: false });
    await expect(payouts.isBookable(COIFFEUR_ID)).resolves.toBe(false);
  });

  it('lets the demo salon take online bookings without its own Stripe account', async () => {
    supabase.seedPayoutAccount({ profileId: COIFFEUR_ID, bookableWithoutPayouts: true });

    await expect(payouts.getStatus(COIFFEUR_ID)).resolves.toMatchObject({ state: 'exempt', onlineBooking: true });
    await expect(payouts.readyAccountId(COIFFEUR_ID)).resolves.toBeNull();
  });

  it("opens Stripe's Express dashboard only once the salon's details are in", async () => {
    supabase.seedPayoutAccount({ profileId: COIFFEUR_ID, stripeAccountId: 'acct_1' });
    stripe.putAccount({ id: 'acct_1', details_submitted: false, charges_enabled: false, payouts_enabled: false });
    await expect(payouts.createDashboardLink(COIFFEUR_ID)).rejects.toThrow(BadRequestException);

    stripe.putAccount({ id: 'acct_1', details_submitted: true, charges_enabled: true, payouts_enabled: true });
    await payouts.getStatus(COIFFEUR_ID);
    await expect(payouts.createDashboardLink(COIFFEUR_ID)).resolves.toEqual({
      url: 'https://connect.stripe.test/express/acct_1',
    });
  });
});
