import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';

export interface AdminMessageSentEvent {
  messageId: string;
  coiffeurId: string;
  body: string;
}

/**
 * "Messagerie interne admin ↔ coiffeur" (TODO.md → Back-office admin) — push
 * only, same reasoning as CoiffeurApplicationNotificationsListener's push
 * side: email is reserved for account-lifecycle decisions, not every message.
 */
@Injectable()
export class AdminMessageNotificationsListener {
  private readonly logger = new Logger(AdminMessageNotificationsListener.name);

  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent('admin-message.sent')
  async onSent(event: AdminMessageSentEvent): Promise<void> {
    try {
      await this.notifications.notifyUser({
        userId: event.coiffeurId,
        type: 'admin_message',
        dedupeKey: event.messageId,
        title: 'Nouveau message de WorldHair',
        body: event.body,
      });
    } catch (error) {
      this.logger.warn('Admin message push notification failed and was dropped', error as Error);
    }
  }
}
