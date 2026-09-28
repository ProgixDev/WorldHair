import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * What the coiffeur hears about their subscription. Pushes state facts only
 * — the app may not point to buying outside it (App Store rule 3.1.3(f)) —
 * and the emails, sent outside the app, carry the link to the website.
 * notifications_log's unique index keeps each one to a single send.
 */
@Injectable()
export class SubscriptionNotifier {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  async ended(profileId: string, dedupeKey: string): Promise<void> {
    const firstTime = await this.notifications.notifyUser({
      userId: profileId,
      type: 'subscription_ended',
      dedupeKey,
      title: 'Votre salon n’est plus visible',
      body: 'Votre abonnement a pris fin : votre salon n’apparaît plus dans la recherche.',
      data: { screen: 'subscription' },
    });
    if (!firstTime) return;
    const email = await this.emailOf(profileId);
    if (email) await this.mail.sendSubscriptionEndedEmail(email);
  }

  async endingSoon(profileId: string, endsAt: string): Promise<void> {
    const firstTime = await this.notifications.notifyUser({
      userId: profileId,
      type: 'subscription_ending_soon',
      dedupeKey: `${profileId}:${endsAt}`,
      title: 'Votre abonnement se termine dans 7 jours',
      body: 'Ensuite, votre salon n’apparaîtra plus dans la recherche.',
      data: { screen: 'subscription' },
    });
    if (!firstTime) return;
    const email = await this.emailOf(profileId);
    if (email) await this.mail.sendSubscriptionEndingSoonEmail(email, endsAt);
  }

  async paymentFailed(profileId: string, dedupeKey: string): Promise<void> {
    await this.notifications.notifyUser({
      userId: profileId,
      type: 'subscription_payment_failed',
      dedupeKey,
      title: 'Paiement de l’abonnement refusé',
      body: 'Le prélèvement de votre abonnement a échoué ; il sera retenté dans les prochains jours.',
      data: { screen: 'subscription' },
    });
  }

  async trialEnding(profileId: string, trialEndsAt: string): Promise<void> {
    await this.notifications.notifyUser({
      userId: profileId,
      type: 'subscription_trial_ending',
      dedupeKey: `${profileId}:${trialEndsAt}`,
      title: 'Fin de votre essai gratuit',
      body: 'Votre essai se termine dans quelques jours ; le premier prélèvement aura lieu ce jour-là.',
      data: { screen: 'subscription' },
    });
  }

  private async emailOf(profileId: string): Promise<string | null> {
    const {
      data: { user },
      error,
    } = await this.supabase.client.auth.admin.getUserById(profileId);
    return error ? null : (user?.email ?? null);
  }
}
