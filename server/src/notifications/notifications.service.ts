import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { PushService } from './push.service';
import { PushTokensService } from './push-tokens.service';

export interface NotificationPreferences {
  reminderDayBefore: boolean;
  reminderHourBefore: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  reminderDayBefore: true,
  reminderHourBefore: true,
};

interface PreferencesRow {
  reminder_day_before: boolean;
  reminder_hour_before: boolean;
}

function mapPreferences(row: PreferencesRow): NotificationPreferences {
  return { reminderDayBefore: row.reminder_day_before, reminderHourBefore: row.reminder_hour_before };
}

export interface NotifyUserInput {
  userId: string;
  /** e.g. "appointment_created" — free-form, paired with dedupeKey for the uniqueness guard. */
  type: string;
  dedupeKey: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * "Notifications" (TODO.md) — same shape as the WhaleTime project
 * (D:\Others\WhaleTime): preferences are a plain read-before-send check at
 * each call site (jobs/listeners), not a central gate here, since only two
 * of the six notification types are ever optional. Dedup is a DB unique
 * index on notifications_log, not a pre-check read — see notifyUser().
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly pushTokens: PushTokensService,
    private readonly push: PushService,
  ) {}

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const { data, error } = await this.supabase.client
      .from('notification_preferences')
      .select()
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data ? mapPreferences(data as PreferencesRow) : DEFAULT_PREFERENCES;
  }

  async updatePreferences(userId: string, patch: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const row: Record<string, unknown> = { user_id: userId };
    if (patch.reminderDayBefore !== undefined) row.reminder_day_before = patch.reminderDayBefore;
    if (patch.reminderHourBefore !== undefined) row.reminder_hour_before = patch.reminderHourBefore;

    const { data, error } = await this.supabase.client
      .from('notification_preferences')
      .upsert(row, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return mapPreferences(data as PreferencesRow);
  }

  /**
   * Records + pushes one notification. Returns false (no-op, already sent)
   * if this exact (user, type, dedupeKey) exists — notifications_log's
   * unique index is the real guard, a retried/overlapping cron run or a
   * duplicate event can't double-send.
   */
  async notifyUser(input: NotifyUserInput): Promise<boolean> {
    const { error } = await this.supabase.client.from('notifications_log').insert({
      user_id: input.userId,
      type: input.type,
      dedupe_key: input.dedupeKey,
      title: input.title,
      body: input.body,
    });
    if (error) {
      if (error.code === '23505') {
        return false;
      }
      throw new InternalServerErrorException(error.message);
    }

    const tokens = await this.pushTokens.listActiveForUser(input.userId);
    if (tokens.length === 0) {
      return true;
    }

    const results = await this.push.send(
      tokens.map((token) => ({ token, title: input.title, body: input.body, data: input.data })),
    );
    await Promise.all(
      results
        .filter((result) => result.error === 'DeviceNotRegistered')
        .map((result) => this.pushTokens.invalidate(result.token)),
    );
    return true;
  }
}
