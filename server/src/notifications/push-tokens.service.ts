import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

export type PushPlatform = 'ios' | 'android';

interface PushTokenRow {
  token: string;
}

/**
 * The token itself, not `(user, token)`, is the unique/upsert key — one
 * physical device can be handed to a different account (logout/login), so
 * `register()` is "this device now belongs to this user", not an append.
 * Same design as the WhaleTime project (D:\Others\WhaleTime).
 */
@Injectable()
export class PushTokensService {
  constructor(private readonly supabase: SupabaseService) {}

  async register(userId: string, token: string, platform: PushPlatform, timezone?: string): Promise<void> {
    const { error } = await this.supabase.client.from('push_tokens').upsert(
      {
        token,
        user_id: userId,
        platform,
        timezone: timezone ?? 'UTC',
        last_seen_at: new Date().toISOString(),
        invalidated_at: null,
      },
      { onConflict: 'token' },
    );
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  /** Ownership-scoped, unlike register — a device can only unregister itself from its own current account. */
  async unregister(userId: string, token: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', token);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async listActiveForUser(userId: string): Promise<string[]> {
    const { data, error } = await this.supabase.client
      .from('push_tokens')
      .select()
      .eq('user_id', userId)
      .is('invalidated_at', null);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data as PushTokenRow[]).map((row) => row.token);
  }

  /** Soft-delete — Expo reported this token as DeviceNotRegistered. */
  async invalidate(token: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('push_tokens')
      .update({ invalidated_at: new Date().toISOString() })
      .eq('token', token);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
