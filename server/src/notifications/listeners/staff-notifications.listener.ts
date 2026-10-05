import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { formatParisDateTime } from '../../common/utils/paris-time';
import { SupabaseService } from '../../database/supabase.service';
import { NotificationsService } from '../notifications.service';
import type {
  AppointmentCancelledByAdminEvent,
  AppointmentCancelledEvent,
  AppointmentMovedEvent,
  AppointmentRescheduledEvent,
} from './appointment-notifications.listener';

/** A booking given to someone of the salon's team: accepted for them, reassigned, or confirmed at once. */
export interface AppointmentAssignedEvent {
  appointmentId: string;
  salonId: string;
  staffId: string;
  serviceName: string;
  startsAt: string;
}

export interface StaffJoinedEvent {
  salonId: string;
  profileId: string;
  staffId: string;
}

/**
 * A salon's team (TODO.md Phase 3): a staff member is told of the bookings
 * that are theirs — given to them, moved, cancelled — and the owner of
 * someone joining. The owner already hears of every booking of his salon
 * (AppointmentNotificationsListener), so his own team row is skipped here.
 */
@Injectable()
export class StaffNotificationsListener {
  private readonly logger = new Logger(StaffNotificationsListener.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent('appointment.assigned')
  async onAssigned(event: AppointmentAssignedEvent): Promise<void> {
    await this.tell(event.staffId, {
      type: 'appointment_assigned',
      dedupeKey: `${event.appointmentId}:${event.staffId}`,
      title: 'Nouveau rendez-vous',
      body: `${event.serviceName}, le ${formatParisDateTime(event.startsAt)}.`,
      data: { appointmentId: event.appointmentId },
    });
  }

  @OnEvent('appointment.moved')
  @OnEvent('appointment.rescheduled')
  async onMoved(event: AppointmentMovedEvent | AppointmentRescheduledEvent): Promise<void> {
    if (!event.staffId) return;
    await this.tell(event.staffId, {
      type: 'appointment_moved_staff',
      dedupeKey: `${event.appointmentId}:${event.startsAt}`,
      title: 'Rendez-vous déplacé',
      body: `${event.serviceName} est déplacé au ${formatParisDateTime(event.startsAt)}.`,
      data: { appointmentId: event.appointmentId },
    });
  }

  @OnEvent('appointment.cancelled')
  @OnEvent('appointment.cancelled_by_admin')
  async onCancelled(event: AppointmentCancelledEvent | AppointmentCancelledByAdminEvent): Promise<void> {
    if (!event.staffId) return;
    await this.tell(event.staffId, {
      type: 'appointment_cancelled_staff',
      dedupeKey: event.appointmentId,
      title: 'Rendez-vous annulé',
      body: `Le rendez-vous du ${formatParisDateTime(event.startsAt)} pour ${event.serviceName} est annulé.`,
      data: { appointmentId: event.appointmentId },
    });
  }

  @OnEvent('staff.joined')
  async onJoined(event: StaffJoinedEvent): Promise<void> {
    await this.safe(async () => {
      const { data, error } = await this.supabase.client
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', event.profileId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const profile = data as { first_name: string; last_name: string } | null;
      const name = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Un coiffeur';
      await this.notifications.notifyUser({
        userId: event.salonId,
        type: 'staff_joined',
        dedupeKey: event.staffId,
        title: 'Nouveau membre',
        body: `${name} a rejoint votre salon.`,
        data: { staffId: event.staffId },
      });
    });
  }

  private async tell(
    staffId: string,
    message: { type: string; dedupeKey: string; title: string; body: string; data: Record<string, unknown> },
  ): Promise<void> {
    await this.safe(async () => {
      const { data, error } = await this.supabase.client
        .from('salon_staff')
        .select('profile_id, salon_id')
        .eq('id', staffId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const member = data as { profile_id: string; salon_id: string } | null;
      // Gone since, or the owner himself.
      if (!member || member.profile_id === member.salon_id) return;
      await this.notifications.notifyUser({ ...message, userId: member.profile_id });
    });
  }

  /** A failed notification must never fail the action that triggered it. */
  private async safe(send: () => Promise<unknown>): Promise<void> {
    try {
      await send();
    } catch (error) {
      this.logger.warn('A staff notification failed', error as Error);
    }
  }
}
