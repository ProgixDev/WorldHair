import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';

export interface AppointmentCreatedEvent {
  appointmentId: string;
  coiffeurId: string;
  serviceName: string;
  startsAt: string;
}

export interface AppointmentConfirmedEvent {
  appointmentId: string;
  particulierId: string;
  serviceName: string;
  startsAt: string;
}

export interface AppointmentCancelledEvent {
  appointmentId: string;
  coiffeurId: string;
  /** Whichever side cancelled — never notify them of their own action. */
  cancelledByUserId: string;
  serviceName: string;
  startsAt: string;
}

/**
 * "Nouveau RDV → coiffeur", "Confirmation RDV → particulier", "Annulation
 * RDV → coiffeur" (TODO.md → Notifications) — all non-désactivable, so no
 * preference check here, unlike the reminder job. Lives in notifications/
 * rather than appointments/ so AppointmentsService has zero import
 * dependency on notifications — same separation as the WhaleTime project's
 * SocialNotificationListener.
 */
@Injectable()
export class AppointmentNotificationsListener {
  private readonly logger = new Logger(AppointmentNotificationsListener.name);

  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent('appointment.created')
  async onCreated(event: AppointmentCreatedEvent): Promise<void> {
    await this.safe(() =>
      this.notifications.notifyUser({
        userId: event.coiffeurId,
        type: 'appointment_created',
        dedupeKey: event.appointmentId,
        title: 'Nouvelle demande de rendez-vous',
        body: `Nouvelle demande pour ${event.serviceName}.`,
        data: { appointmentId: event.appointmentId },
      }),
    );
  }

  @OnEvent('appointment.confirmed')
  async onConfirmed(event: AppointmentConfirmedEvent): Promise<void> {
    await this.safe(() =>
      this.notifications.notifyUser({
        userId: event.particulierId,
        type: 'appointment_confirmed',
        dedupeKey: event.appointmentId,
        title: 'Rendez-vous confirmé',
        body: `Votre rendez-vous pour ${event.serviceName} est confirmé.`,
        data: { appointmentId: event.appointmentId },
      }),
    );
  }

  @OnEvent('appointment.cancelled')
  async onCancelled(event: AppointmentCancelledEvent): Promise<void> {
    if (event.coiffeurId === event.cancelledByUserId) {
      return;
    }
    await this.safe(() =>
      this.notifications.notifyUser({
        userId: event.coiffeurId,
        type: 'appointment_cancelled',
        dedupeKey: event.appointmentId,
        title: 'Rendez-vous annulé',
        body: `Le rendez-vous pour ${event.serviceName} a été annulé.`,
        data: { appointmentId: event.appointmentId },
      }),
    );
  }

  /** A failed notification must never fail the booking action that triggered it. */
  private async safe(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (error) {
      this.logger.warn('Appointment notification failed and was dropped', error as Error);
    }
  }
}
