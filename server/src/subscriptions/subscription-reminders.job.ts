import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../database/supabase.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SubscriptionRow, subscriptionEndsAt } from './subscription-state';

const DAY_MS = 86_400_000;

/**
 * A week before a salon would drop out of search — a cancellation scheduled
 * in Stripe's portal, or an offered subscription running out — the coiffeur
 * gets a push and an email with the way back (TODO.md Phase 4). Hourly, over
 * a 6-to-8-day window: notifications_log's unique index keeps it to one
 * reminder per end date, however many runs see it.
 */
@Injectable()
export class SubscriptionRemindersJob {
  private readonly logger = new Logger(SubscriptionRemindersJob.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    const now = Date.now();
    const from = new Date(now + 6 * DAY_MS).toISOString();
    const to = new Date(now + 8 * DAY_MS).toISOString();

    const [scheduled, offered] = await Promise.all([
      this.supabase.client.from('coiffeur_subscriptions').select().gte('cancel_at', from).lte('cancel_at', to),
      this.supabase.client
        .from('coiffeur_subscriptions')
        .select()
        .is('stripe_subscription_id', null)
        .gte('current_period_end', from)
        .lte('current_period_end', to),
    ]);
    if (scheduled.error || offered.error) {
      this.logger.error('Failed to load subscriptions ending soon', (scheduled.error ?? offered.error)?.message);
      return;
    }

    for (const row of [...(scheduled.data as SubscriptionRow[]), ...(offered.data as SubscriptionRow[])]) {
      const endsAt = subscriptionEndsAt(row);
      if (!endsAt) continue;
      try {
        await this.remind(row.profile_id, endsAt);
      } catch (err) {
        this.logger.warn(`Subscription reminder failed for ${row.profile_id}`, err as Error);
      }
    }
  }

  private async remind(profileId: string, endsAt: string): Promise<void> {
    const firstTime = await this.notifications.notifyUser({
      userId: profileId,
      type: 'subscription_ending_soon',
      dedupeKey: `${profileId}:${endsAt}`,
      title: 'Votre abonnement se termine dans 7 jours',
      body: 'Ensuite, les clients ne trouveront plus votre salon. Nous vous avons envoyé par email la marche à suivre pour le garder.',
      data: { screen: 'subscription' },
    });
    if (!firstTime) return;

    const {
      data: { user },
      error,
    } = await this.supabase.client.auth.admin.getUserById(profileId);
    if (!error && user?.email) {
      await this.mail.sendSubscriptionEndingSoonEmail(user.email, endsAt);
    }
  }
}
