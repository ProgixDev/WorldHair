import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { formatParisDateTime } from '../../common/utils/paris-time';
import { NotificationsService } from '../notifications.service';

export interface AppointmentCreatedEvent {
  appointmentId: string;
  coiffeurId: string;
  serviceName: string;
  startsAt: string;
  /** `confirmed` when the salon confirms bookings instantly — then it's a booking, not a request. */
  status: 'pending' | 'confirmed';
}

export interface AppointmentConfirmedEvent {
  appointmentId: string;
  particulierId: string;
  serviceName: string;
  startsAt: string;
}

/** Same shape as a confirmation — the coiffeur turned the request down instead. */
export type AppointmentRefusedEvent = AppointmentConfirmedEvent;

export interface AppointmentCancelledEvent {
  appointmentId: string;
  coiffeurId: string;
  particulierId: string;
  /** Whichever side cancelled — only the other side is notified. */
  cancelledByUserId: string;
  serviceName: string;
  startsAt: string;
}

/** WorldHair cancelled a booking to settle a dispute (admin → Rendez-vous): both sides are told why. */
export interface AppointmentCancelledByAdminEvent {
  appointmentId: string;
  coiffeurId: string;
  particulierId: string;
  serviceName: string;
  startsAt: string;
  reason: string;
  /** Euros given back now: 0 when nothing was paid in the app, or Stripe couldn't refund yet. */
  refunded: number;
}

export interface AppointmentRescheduledEvent {
  appointmentId: string;
  coiffeurId: string;
  serviceName: string;
  previousStartsAt: string;
  startsAt: string;
}

/** A request the salon never answered before its time: cancelled, and the client refunded. */
export interface AppointmentExpiredEvent {
  appointmentId: string;
  particulierId: string;
  coiffeurId: string;
  serviceName: string;
  startsAt: string;
  /** Euros given back now: 0 for a request not paid in the app, or a refund the job makes later (its own push then). */
  refunded: number;
}

/** Money went back to the client (payments/payments.service.ts). */
export interface PaymentRefundedEvent {
  appointmentId: string;
  particulierId: string;
  /** Euros refunded this time. */
  amount: number;
  /** Euros refunded on this appointment so far, this time included — tells refunds apart. */
  refundedTotal: number;
}

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

/** The coiffeur moved an accepted appointment — the particulier is told. */
export interface AppointmentMovedEvent {
  appointmentId: string;
  particulierId: string;
  serviceName: string;
  previousStartsAt: string;
  startsAt: string;
}

/**
 * Every booking event the other side needs to hear about: new request →
 * coiffeur, confirmation or refusal → particulier, cancellation → whichever
 * side didn't cancel (both, when WorldHair did), move → coiffeur. All non-désactivable, so no
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
    const when = formatParisDateTime(event.startsAt);
    await this.safe(() =>
      this.notifications.notifyUser({
        userId: event.coiffeurId,
        type: 'appointment_created',
        dedupeKey: event.appointmentId,
        ...(event.status === 'confirmed'
          ? { title: 'Nouveau rendez-vous', body: `${event.serviceName}, le ${when}.` }
          : { title: 'Nouvelle demande de rendez-vous', body: `${event.serviceName}, le ${when}. À accepter ou refuser.` }),
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

  @OnEvent('appointment.refused')
  async onRefused(event: AppointmentRefusedEvent): Promise<void> {
    await this.safe(() =>
      this.notifications.notifyUser({
        userId: event.particulierId,
        type: 'appointment_refused',
        dedupeKey: event.appointmentId,
        title: 'Demande refusée',
        body: `Le salon ne peut pas vous recevoir le ${formatParisDateTime(event.startsAt)} pour ${event.serviceName}. Choisissez un autre créneau.`,
        data: { appointmentId: event.appointmentId },
      }),
    );
  }

  @OnEvent('appointment.cancelled')
  async onCancelled(event: AppointmentCancelledEvent): Promise<void> {
    const cancelledBySalon = event.cancelledByUserId === event.coiffeurId;
    await this.safe(() =>
      this.notifications.notifyUser(
        cancelledBySalon
          ? {
              userId: event.particulierId,
              type: 'appointment_cancelled',
              dedupeKey: event.appointmentId,
              title: 'Rendez-vous annulé',
              body: `Le salon a annulé votre rendez-vous du ${formatParisDateTime(event.startsAt)} pour ${event.serviceName}.`,
              data: { appointmentId: event.appointmentId },
            }
          : {
              userId: event.coiffeurId,
              type: 'appointment_cancelled',
              dedupeKey: event.appointmentId,
              title: 'Rendez-vous annulé',
              body: `Le rendez-vous du ${formatParisDateTime(event.startsAt)} pour ${event.serviceName} a été annulé.`,
              data: { appointmentId: event.appointmentId },
            },
      ),
    );
  }

  @OnEvent('appointment.cancelled_by_admin')
  async onCancelledByAdmin(event: AppointmentCancelledByAdminEvent): Promise<void> {
    const reason = /[.!?…]$/.test(event.reason) ? event.reason : `${event.reason}.`;
    const about = `Votre rendez-vous du ${formatParisDateTime(event.startsAt)} pour ${event.serviceName} est annulé par l'équipe WorldHair. Motif : ${reason}`;
    const notice = { type: 'appointment_cancelled_admin', dedupeKey: event.appointmentId, title: 'Rendez-vous annulé par WorldHair' };
    await this.safe(() =>
      this.notifications.notifyUser({
        ...notice,
        userId: event.particulierId,
        body: about + (event.refunded > 0 ? ' Vous êtes intégralement remboursé.' : ''),
        data: { appointmentId: event.appointmentId },
      }),
    );
    await this.safe(() =>
      this.notifications.notifyUser({ ...notice, userId: event.coiffeurId, body: about, data: { appointmentId: event.appointmentId } }),
    );
  }

  @OnEvent('appointment.rescheduled')
  async onRescheduled(event: AppointmentRescheduledEvent): Promise<void> {
    await this.safe(() =>
      this.notifications.notifyUser({
        userId: event.coiffeurId,
        type: 'appointment_rescheduled',
        // One per new time: each move is news, the dedupe index only guards against double sends.
        dedupeKey: `${event.appointmentId}:${event.startsAt}`,
        title: 'Rendez-vous déplacé',
        body: `Le rendez-vous pour ${event.serviceName} est déplacé au ${formatParisDateTime(event.startsAt)}.`,
        data: { appointmentId: event.appointmentId },
      }),
    );
  }

  @OnEvent('appointment.moved')
  async onMoved(event: AppointmentMovedEvent): Promise<void> {
    await this.safe(() =>
      this.notifications.notifyUser({
        userId: event.particulierId,
        type: 'appointment_moved',
        dedupeKey: `${event.appointmentId}:${event.startsAt}`,
        title: 'Rendez-vous déplacé par le salon',
        body: `Votre rendez-vous pour ${event.serviceName} est déplacé au ${formatParisDateTime(event.startsAt)}.`,
        data: { appointmentId: event.appointmentId },
      }),
    );
  }

  /** A failed notification must never fail the booking action that triggered it. */
  @OnEvent('appointment.expired')
  async onExpired(event: AppointmentExpiredEvent): Promise<void> {
    await this.safe(() =>
      this.notifications.notifyUser({
        userId: event.particulierId,
        type: 'appointment_expired',
        dedupeKey: event.appointmentId,
        title: 'Demande sans réponse',
        body:
          `Le salon n'a pas répondu à votre demande du ${formatParisDateTime(event.startsAt)} pour ${event.serviceName}.` +
          (event.refunded > 0 ? ' Vous êtes intégralement remboursé.' : ''),
        data: { appointmentId: event.appointmentId },
      }),
    );
  }

  @OnEvent('payment.refunded')
  async onRefunded(event: PaymentRefundedEvent): Promise<void> {
    const amount = euros.format(event.amount).replace(/ | /g, ' ');
    await this.safe(() =>
      this.notifications.notifyUser({
        userId: event.particulierId,
        type: 'payment_refunded',
        // Each refund once, even several on one appointment.
        dedupeKey: `${event.appointmentId}:${event.refundedTotal}`,
        title: `Remboursement de ${amount}`,
        body: 'Il apparaîtra sur votre compte bancaire sous quelques jours.',
        data: { appointmentId: event.appointmentId },
      }),
    );
  }

  private async safe(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (error) {
      this.logger.warn('Appointment notification failed and was dropped', error as Error);
    }
  }
}
