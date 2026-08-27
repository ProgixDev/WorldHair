import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

export interface Profile {
  username: string | null;
  displayName: string;
}

export interface UpdateProfileInput {
  username?: string;
  displayName?: string;
}

// Postgres unique_violation — https://www.postgresql.org/docs/current/errcodes-appendix.html
const UNIQUE_VIOLATION = '23505';

/**
 * Reads/writes one row of the `profiles` table (see `../../schema.sql`),
 * keyed by the Supabase auth user's id. Registration and session issuance
 * happen entirely on Supabase's side (see `auth/auth.module.ts`) — by the
 * time any of these methods run, `handle_new_user()` (the schema's trigger)
 * has already inserted an empty row for this user.
 */
@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('username, display_name')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      return null;
    }

    return { username: data.username, displayName: data.display_name ?? '' };
  }

  async updateProfile(userId: string, changes: UpdateProfileInput): Promise<Profile | null> {
    const patch: Record<string, unknown> = {};
    if (changes.username !== undefined) {
      patch.username = changes.username;
    }
    if (changes.displayName !== undefined) {
      patch.display_name = changes.displayName;
    }

    const { data, error } = await this.supabase.client
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select('username, display_name')
      .maybeSingle();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new ConflictException('That username is already taken');
      }
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      return null;
    }

    return { username: data.username, displayName: data.display_name ?? '' };
  }
}
