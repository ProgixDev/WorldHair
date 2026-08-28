import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

export interface Profile {
  firstName: string;
  lastName: string;
  photoUrl: string | null;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  photoUrl?: string | null;
}

/**
 * Reads/writes one row of the `profiles` table (see `../../schema.sql`),
 * keyed by the Supabase auth user's id. Registration and session issuance
 * happen entirely on Supabase's side (see `auth/auth.module.ts`) — by the
 * time any of these methods run, `handle_new_user()` (the schema's trigger)
 * has already inserted an empty row for this user.
 *
 * The mobile app itself reads/writes this same row directly via Supabase
 * (RLS lets the owner do that — see mobile/src/services/auth.ts); this
 * endpoint exists for any other client (a future admin panel, etc.) that
 * would rather go through this API than hold its own Supabase client.
 */
@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('first_name, last_name, photo_url')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      return null;
    }

    return { firstName: data.first_name ?? '', lastName: data.last_name ?? '', photoUrl: data.photo_url };
  }

  async updateProfile(userId: string, changes: UpdateProfileInput): Promise<Profile | null> {
    const patch: Record<string, unknown> = {};
    if (changes.firstName !== undefined) {
      patch.first_name = changes.firstName;
    }
    if (changes.lastName !== undefined) {
      patch.last_name = changes.lastName;
    }
    if (changes.photoUrl !== undefined) {
      patch.photo_url = changes.photoUrl;
    }

    const { data, error } = await this.supabase.client
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select('first_name, last_name, photo_url')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      return null;
    }

    return { firstName: data.first_name ?? '', lastName: data.last_name ?? '', photoUrl: data.photo_url };
  }
}
