import { isListed, SubscriptionRow, subscriptionEndsAt, subscriptionState } from './subscription-state';

const NOW = new Date('2026-10-01T10:00:00.000Z');
const LATER = '2026-11-01T10:00:00.000Z';
const EARLIER = '2026-09-01T10:00:00.000Z';

function row(overrides: Partial<SubscriptionRow>): SubscriptionRow {
  return {
    profile_id: 'coiffeur-1',
    plan: 'monthly',
    tier: 'solo',
    status: 'active',
    stripe_customer_id: 'cus_1',
    stripe_subscription_id: 'sub_1',
    trial_ends_at: null,
    current_period_end: LATER,
    cancel_at: null,
    ...overrides,
  };
}

describe('subscription state', () => {
  describe('isListed', () => {
    it('lists a salon while Stripe says trialing, active, or past_due (retrying a failed payment)', () => {
      expect(isListed(row({ status: 'trialing' }), NOW)).toBe(true);
      expect(isListed(row({ status: 'active' }), NOW)).toBe(true);
      expect(isListed(row({ status: 'past_due' }), NOW)).toBe(true);
    });

    it('hides it once the subscription is over, unpaid, or never started', () => {
      expect(isListed(null, NOW)).toBe(false);
      expect(isListed(row({ status: 'none', stripe_subscription_id: null, current_period_end: null }), NOW)).toBe(false);
      expect(isListed(row({ status: 'canceled' }), NOW)).toBe(false);
      expect(isListed(row({ status: 'unpaid' }), NOW)).toBe(false);
      expect(isListed(row({ status: 'incomplete' }), NOW)).toBe(false);
      expect(isListed(row({ status: 'incomplete_expired' }), NOW)).toBe(false);
      expect(isListed(row({ status: 'paused' }), NOW)).toBe(false);
    });

    it('stops listing a Stripe subscription whose period ended days ago without news from Stripe', () => {
      const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();
      expect(isListed(row({ status: 'active', current_period_end: daysAgo(1) }), NOW)).toBe(true);
      expect(isListed(row({ status: 'active', current_period_end: daysAgo(4) }), NOW)).toBe(false);
      expect(isListed(row({ status: 'past_due', current_period_end: daysAgo(4) }), NOW)).toBe(false);
    });

    it('lists an offered subscription (no Stripe subscription) until its end date', () => {
      const offered = { stripe_customer_id: null, stripe_subscription_id: null };
      expect(isListed(row({ ...offered, current_period_end: LATER }), NOW)).toBe(true);
      expect(isListed(row({ ...offered, current_period_end: EARLIER }), NOW)).toBe(false);
    });
  });

  describe('subscriptionState and subscriptionEndsAt', () => {
    it('follows Stripe, and a scheduled cancellation reads as "ending" at that date', () => {
      expect(subscriptionState(row({ status: 'trialing', trial_ends_at: LATER }), NOW)).toBe('trialing');
      expect(subscriptionState(row({ status: 'active' }), NOW)).toBe('active');
      expect(subscriptionState(row({ status: 'past_due' }), NOW)).toBe('past_due');
      expect(subscriptionState(row({ status: 'incomplete' }), NOW)).toBe('incomplete');

      const ending = row({ status: 'active', cancel_at: LATER });
      expect(subscriptionState(ending, NOW)).toBe('ending');
      expect(subscriptionEndsAt(ending, NOW)).toBe(LATER);
      expect(subscriptionState(row({ status: 'trialing', cancel_at: LATER }), NOW)).toBe('ending');
    });

    it('has no end date while it renews on its own', () => {
      expect(subscriptionEndsAt(row({ status: 'active' }), NOW)).toBeNull();
      expect(subscriptionEndsAt(row({ status: 'trialing', trial_ends_at: LATER }), NOW)).toBeNull();
    });

    it('reads as "expired" once it no longer lists the salon', () => {
      for (const status of ['canceled', 'unpaid', 'incomplete_expired', 'paused'] as const) {
        expect(subscriptionState(row({ status }), NOW)).toBe('expired');
      }
      expect(subscriptionEndsAt(row({ status: 'canceled' }), NOW)).toBeNull();
    });

    it('reads as "none" before any subscription', () => {
      expect(subscriptionState(null, NOW)).toBe('none');
      expect(
        subscriptionState(row({ status: 'none', stripe_subscription_id: null, current_period_end: null }), NOW),
      ).toBe('none');
    });

    it('shows an offered subscription as active until its end date, then expired', () => {
      const offered = row({ stripe_customer_id: null, stripe_subscription_id: null, current_period_end: LATER });
      expect(subscriptionState(offered, NOW)).toBe('active');
      expect(subscriptionEndsAt(offered, NOW)).toBe(LATER);
      expect(subscriptionState({ ...offered, current_period_end: EARLIER }, NOW)).toBe('expired');
    });
  });
});
