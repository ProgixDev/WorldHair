import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { SupabaseService } from '../database/supabase.service';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  let supabase: FakeSupabaseService;
  let service: SubscriptionsService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    service = new SubscriptionsService(supabase as unknown as SupabaseService);

    supabase.addUser('token-coiffeur', { id: 'coiffeur-1', email: 'sofia@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' }, 'coiffeur', {
      firstName: 'Sofia',
      lastName: 'Benali',
    });
  });

  it('getOrCreateMine() lazily creates a 30-day trial on first read', async () => {
    const subscription = await service.getOrCreateMine('coiffeur-1');

    expect(subscription).toMatchObject({ profileId: 'coiffeur-1', plan: 'monthly', status: 'trial' });
    expect(subscription.trialEndsAt).not.toBeNull();
    expect(subscription.renewsAt).toBe(subscription.trialEndsAt);
  });

  it('getOrCreateMine() returns the same row on a second call, not a new trial', async () => {
    const first = await service.getOrCreateMine('coiffeur-1');
    const second = await service.getOrCreateMine('coiffeur-1');

    expect(second.trialEndsAt).toBe(first.trialEndsAt);
  });

  it('changePlan() during a trial keeps the trial end date', async () => {
    const initial = await service.getOrCreateMine('coiffeur-1');
    const updated = await service.changePlan('coiffeur-1', 'yearly');

    expect(updated.plan).toBe('yearly');
    expect(updated.status).toBe('trial');
    expect(updated.renewsAt).toBe(initial.trialEndsAt);
  });

  it('changePlan() reactivates a cancelled subscription as active', async () => {
    await service.getOrCreateMine('coiffeur-1');
    await service.cancel('coiffeur-1');

    const updated = await service.changePlan('coiffeur-1', 'monthly');

    expect(updated.status).toBe('active');
  });

  it('cancel() then reactivate() restores trial when a trial end date exists', async () => {
    await service.getOrCreateMine('coiffeur-1');
    await service.cancel('coiffeur-1');
    const reactivated = await service.reactivate('coiffeur-1');

    expect(reactivated.status).toBe('trial');
  });

  it('listAllForAdmin() shows "not_started" for a coiffeur who never opened the subscription screen', async () => {
    supabase.addUser('token-coiffeur-2', { id: 'coiffeur-2', email: 'camille@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' }, 'coiffeur', {
      firstName: 'Camille',
      lastName: 'Durand',
    });

    const summaries = await service.listAllForAdmin();

    expect(summaries).toHaveLength(2);
    const camille = summaries.find((s) => s.profileId === 'coiffeur-2');
    expect(camille).toMatchObject({ status: 'not_started', trialEndsAt: null, renewsAt: null });
  });

  it('listAllForAdmin() shows "expired" once a trial\'s end date has passed', async () => {
    supabase.seedSubscription({
      profileId: 'coiffeur-1',
      status: 'trial',
      trialEndsAt: new Date(Date.now() - 86_400_000).toISOString(),
      renewsAt: new Date(Date.now() - 86_400_000).toISOString(),
    });

    const summaries = await service.listAllForAdmin();

    expect(summaries.find((s) => s.profileId === 'coiffeur-1')).toMatchObject({ status: 'expired' });
  });

  it('listAllForAdmin() never shows "expired" for an auto-renewing active subscription', async () => {
    // "active" never counts down, even with a past renews_at.
    supabase.seedSubscription({
      profileId: 'coiffeur-1',
      status: 'active',
      trialEndsAt: null,
      renewsAt: new Date(Date.now() - 86_400_000).toISOString(),
    });

    const summaries = await service.listAllForAdmin();

    expect(summaries.find((s) => s.profileId === 'coiffeur-1')).toMatchObject({ status: 'active' });
  });
});
