import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../../database/supabase.service';
import { MailService } from '../../mail/mail.service';
import { NotificationsService } from '../notifications.service';
import { PushTokensService } from '../push-tokens.service';

interface AppointmentRow {
  id: string;
  particulier_id: string;
  service_name: string;
  starts_at: string;
}

/**
 * "Rappel RDV J-1" / "Rappel RDV H-1" (TODO.md → Notifications), both
 * désactivable. Runs every 10 minutes; each window (23-25h / 45-75min) is
 * deliberately wider than that interval — same as the WhaleTime project's
 * equivalent jobs — because notifications_log's unique index is the real
 * duplicate guard, not the window's precision. A wide window just means a
 * delayed or missed run still catches everything exactly once.
 */
@Injectable()
export class AppointmentRemindersJob {
  private readonly logger = new Logger(AppointmentRemindersJob.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly notifications: NotificationsService,
    private readonly pushTokens: PushTokensService,
    private readonly mail: MailService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run(): Promise<void> {
    await this.remind({
      type: 'appointment_reminder_j1',
      fromMinutes: 23 * 60,
      toMinutes: 25 * 60,
      whenLabel: 'demain',
      isEnabled: (prefs) => prefs.reminderDayBefore,
      emailWithoutPush: true,
    });
    await this.remind({
      type: 'appointment_reminder_h1',
      fromMinutes: 45,
      toMinutes: 75,
      whenLabel: "dans moins d'une heure",
      isEnabled: (prefs) => prefs.reminderHourBefore,
      emailWithoutPush: false,
    });
  }

  private async remind(params: {
    type: string;
    fromMinutes: number;
    toMinutes: number;
    whenLabel: string;
    isEnabled: (prefs: { reminderDayBefore: boolean; reminderHourBefore: boolean }) => boolean;
    /** The J-1 reminder also goes by email to a client no push can reach — H-1 would arrive too late to matter. */
    emailWithoutPush: boolean;
  }): Promise<void> {
    const now = Date.now();
    const from = new Date(now + params.fromMinutes * 60000).toISOString();
    const to = new Date(now + params.toMinutes * 60000).toISOString();

    const { data, error } = await this.supabase.client
      .from('appointments')
      .select()
      .eq('status', 'confirmed')
      .gte('starts_at', from)
      .lte('starts_at', to);
    if (error) {
      this.logger.error(`Failed to load candidates for ${params.type}`, error.message);
      return;
    }

    for (const row of data as AppointmentRow[]) {
      try {
        const prefs = await this.notifications.getPreferences(row.particulier_id);
        if (!params.isEnabled(prefs)) {
          continue;
        }
        const firstTime = await this.notifications.notifyUser({
          userId: row.particulier_id,
          type: params.type,
          // Per start time: a booking moved after its reminder gets one for its new time.
          dedupeKey: `${row.id}:${row.starts_at}`,
          title: 'Rappel de rendez-vous',
          body: `Votre rendez-vous pour ${row.service_name} est ${params.whenLabel}.`,
          data: { appointmentId: row.id },
        });
        // notifyUser's dedupe log also guards the email: it's false on every later run.
        if (params.emailWithoutPush && firstTime) {
          await this.emailIfNoPush(row);
        }
      } catch (err) {
        this.logger.warn(`Reminder failed for appointment ${row.id}`, err as Error);
      }
    }
  }

  private async emailIfNoPush(row: AppointmentRow): Promise<void> {
    const tokens = await this.pushTokens.listActiveForUser(row.particulier_id);
    if (tokens.length > 0) return;

    const {
      data: { user },
      error,
    } = await this.supabase.client.auth.admin.getUserById(row.particulier_id);
    if (error || !user?.email) return;
    await this.mail.sendAppointmentReminderEmail(user.email, row.service_name, row.starts_at);
  }
}
