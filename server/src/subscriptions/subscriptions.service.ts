import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

export type SubscriptionPlan = 'monthly' | 'yearly';
export type SubscriptionStatus = 'trial' | 'active' | 'cancelled';
export type DisplaySubscriptionStatus = SubscriptionStatus | 'expired' | 'not_started';

export interface Subscription {
  profileId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  renewsAt: string;
}

export interface AdminSubscriptionSummary {
  profileId: string;
  firstName: string;
  lastName: string;
  email: string;
  plan: SubscriptionPlan;
  status: DisplaySubscriptionStatus;
  trialEndsAt: string | null;
  renewsAt: string | null;
}

interface SubscriptionRow {
  profile_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  renews_at: string;
}

interface ProfileRow {
  id: string;
  first_name: string;
  last_name: string;
}

function mapRow(row: SubscriptionRow): Subscription {
  return {
    profileId: row.profile_id,
    plan: row.plan,
    status: row.status,
    trialEndsAt: row.trial_ends_at,
    renewsAt: row.renews_at,
  };
}

/** A "counting down" subscription (trial/cancelled) has a real end date it can lapse at; "active" auto-renews and never counts down. Mirrors mobile/src/features/pro/subscription.ts. */
function isCountingDown(status: SubscriptionStatus): boolean {
  return status === 'trial' || status === 'cancelled';
}

function endsAt(row: SubscriptionRow): string {
  return row.status === 'trial' && row.trial_ends_at ? row.trial_ends_at : row.renews_at;
}

function displayStatus(row: SubscriptionRow | undefined, now: Date): DisplaySubscriptionStatus {
  if (!row) return 'not_started';
  if (isCountingDown(row.status) && new Date(endsAt(row)).getTime() < now.getTime()) {
    return 'expired';
  }
  return row.status;
}

/**
 * "Vue abonnements coiffeurs (statut, échéance)" (TODO.md → Back-office
 * admin) + mobile's "Écran abonnement" (`mobile/src/features/pro/`) — this
 * is the real backing store for what was, until now, entirely mocked in
 * AsyncStorage (`mobile/src/services/pro.ts`). No real payment processing
 * here — that's Apple IAP / Google Play Billing, still TODO.md work.
 */
@Injectable()
export class SubscriptionsService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Lazily creates a default 30-day-trial subscription on first read, mirroring the mobile mock's `seedSubscription()`. */
  async getOrCreateMine(profileId: string): Promise<Subscription> {
    const existing = await this.findByProfileId(profileId);
    if (existing) return mapRow(existing);

    const trialEndsAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const { data, error } = await this.supabase.client
      .from('coiffeur_subscriptions')
      .insert({
        profile_id: profileId,
        plan: 'monthly',
        status: 'trial',
        trial_ends_at: trialEndsAt,
        renews_at: trialEndsAt,
      })
      .select()
      .single();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return mapRow(data as SubscriptionRow);
  }

  /** Mirrors mobile's `changePlan()`: trial keeps its end date, otherwise renews a month/year from now; reactivates a cancelled subscription. */
  async changePlan(profileId: string, plan: SubscriptionPlan): Promise<Subscription> {
    const current = await this.getOrCreateMine(profileId);

    const renewsAt = new Date();
    if (current.status === 'trial' && current.trialEndsAt) {
      renewsAt.setTime(new Date(current.trialEndsAt).getTime());
    } else if (plan === 'yearly') {
      renewsAt.setFullYear(renewsAt.getFullYear() + 1);
    } else {
      renewsAt.setMonth(renewsAt.getMonth() + 1);
    }

    return this.update(profileId, {
      plan,
      status: current.status === 'cancelled' ? 'active' : current.status,
      renews_at: renewsAt.toISOString(),
    });
  }

  async cancel(profileId: string): Promise<Subscription> {
    await this.getOrCreateMine(profileId);
    return this.update(profileId, { status: 'cancelled' });
  }

  async reactivate(profileId: string): Promise<Subscription> {
    const current = await this.getOrCreateMine(profileId);
    return this.update(profileId, { status: current.trialEndsAt ? 'trial' : 'active' });
  }

  async listAllForAdmin(): Promise<AdminSubscriptionSummary[]> {
    const { data: profiles, error: profilesError } = await this.supabase.client
      .from('profiles')
      .select()
      .eq('role', 'coiffeur');
    if (profilesError) {
      throw new InternalServerErrorException(profilesError.message);
    }

    const { data: subs, error: subsError } = await this.supabase.client
      .from('coiffeur_subscriptions')
      .select();
    if (subsError) {
      throw new InternalServerErrorException(subsError.message);
    }

    const profileRows = profiles as ProfileRow[];
    const subRows = subs as SubscriptionRow[];
    const subByProfileId = new Map(subRows.map((row) => [row.profile_id, row]));
    const emailById = await this.emailsById(profileRows.map((row) => row.id));
    const now = new Date();

    return profileRows.map((profile) => {
      const sub = subByProfileId.get(profile.id);
      return {
        profileId: profile.id,
        firstName: profile.first_name,
        lastName: profile.last_name,
        email: emailById.get(profile.id) ?? '',
        plan: sub?.plan ?? 'monthly',
        status: displayStatus(sub, now),
        trialEndsAt: sub?.trial_ends_at ?? null,
        renewsAt: sub?.renews_at ?? null,
      };
    });
  }

  private async findByProfileId(profileId: string): Promise<SubscriptionRow | null> {
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

  private async update(profileId: string, patch: Record<string, unknown>): Promise<Subscription> {
    const { data, error } = await this.supabase.client
      .from('coiffeur_subscriptions')
      .update(patch)
      .eq('profile_id', profileId)
      .select()
      .single();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return mapRow(data as SubscriptionRow);
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
