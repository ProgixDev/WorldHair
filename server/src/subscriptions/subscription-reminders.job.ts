import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../database/supabase.service';
import { SubscriptionNotifier } from './subscription-notifier';
import { SubscriptionRow, subscriptionEndsAt } from './subscription-state';

const DAY_MS = 86_400_000;

/**
 * A week before a salon would drop out of search — a cancellation scheduled
 * in Stripe's portal, or an offered subscription running out — the coiffeur
 * gets a push and an email with the way back (TODO.md Phase 4); an offered
 * period that has just run out gets the "ended" message Stripe's webhooks
 * give the others. Hourly, over windows wider than the hour:
 * notifications_log's unique index keeps each message to one send.
 */
@Injectable()
export class SubscriptionRemindersJob {
  private readonly logger = new Logger(SubscriptionRemindersJob.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly notifier: SubscriptionNotifier,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    const now = Date.now();
    const iso = (offsetDays: number) => new Date(now + offsetDays * DAY_MS).toISOString();
    const subscriptions = () => this.supabase.client.from('coiffeur_subscriptions').select();

    const [scheduled, offeredEnding, offeredEnded] = await Promise.all([
      subscriptions().gte('cancel_at', iso(6)).lte('cancel_at', iso(8)),
      subscriptions().is('stripe_subscription_id', null).gte('current_period_end', iso(6)).lte('current_period_end', iso(8)),
      subscriptions().is('stripe_subscription_id', null).gte('current_period_end', iso(-2)).lte('current_period_end', iso(0)),
    ]);
    const failed = scheduled.error ?? offeredEnding.error ?? offeredEnded.error;
    if (failed) {
      this.logger.error('Failed to load subscriptions to remind', failed.message);
      return;
    }

    for (const row of [...(scheduled.data as SubscriptionRow[]), ...(offeredEnding.data as SubscriptionRow[])]) {
      const endsAt = subscriptionEndsAt(row);
      if (!endsAt) continue;
      await this.safely(row.profile_id, () => this.notifier.endingSoon(row.profile_id, endsAt));
    }
    for (const row of offeredEnded.data as SubscriptionRow[]) {
      await this.safely(row.profile_id, () =>
        this.notifier.ended(row.profile_id, `${row.profile_id}:offered:${row.current_period_end}`),
      );
    }
  }

  private async safely(profileId: string, send: () => Promise<void>): Promise<void> {
    try {
      await send();
    } catch (err) {
      this.logger.warn(`Subscription reminder failed for ${profileId}`, err as Error);
    }
  }
}
