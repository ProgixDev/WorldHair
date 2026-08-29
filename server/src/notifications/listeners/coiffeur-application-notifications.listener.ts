import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SupabaseService } from '../../database/supabase.service';
import { MailService } from '../../mail/mail.service';
import { NotificationsService } from '../notifications.service';

export interface CoiffeurApplicationDecidedEvent {
  applicationId: string;
  profileId: string;
  status: 'validated' | 'rejected';
  reviewMessage?: string | null;
}

/**
 * "Validation/refus compte coiffeur → coiffeur" (TODO.md → Notifications) —
 * the one notification type that goes by email as well as push, since it's
 * an account-lifecycle decision (same reasoning WhaleTime uses email only
 * for verification/password-reset, never for in-app social activity).
 */
@Injectable()
export class CoiffeurApplicationNotificationsListener {
  private readonly logger = new Logger(CoiffeurApplicationNotificationsListener.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly supabase: SupabaseService,
  ) {}

  @OnEvent('coiffeur-application.decided')
  async onDecided(event: CoiffeurApplicationDecidedEvent): Promise<void> {
    const validated = event.status === 'validated';
    const title = validated ? 'Compte coiffeur validé' : 'Dossier coiffeur refusé';
    const body = validated
      ? 'Votre compte coiffeur a été validé. Bienvenue !'
      : event.reviewMessage
        ? `Votre dossier a été refusé : ${event.reviewMessage}`
        : 'Votre dossier a été refusé.';

    try {
      await this.notifications.notifyUser({
        userId: event.profileId,
        type: 'coiffeur_application_decided',
        // Includes status: a later re-decision after resubmission (e.g.
        // rejected, corrected, then validated) must notify again.
        dedupeKey: `${event.applicationId}:${event.status}`,
        title,
        body,
      });
    } catch (error) {
      this.logger.warn('Coiffeur application push notification failed and was dropped', error as Error);
    }

    try {
      const {
        data: { user },
        error,
      } = await this.supabase.client.auth.admin.getUserById(event.profileId);
      if (error || !user?.email) {
        return;
      }
      await this.mail.sendCoiffeurApplicationDecidedEmail(user.email, event.status, event.reviewMessage);
    } catch (error) {
      this.logger.warn('Coiffeur application email failed and was dropped', error as Error);
    }
  }
}
