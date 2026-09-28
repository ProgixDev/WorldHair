import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { TERMS_VERSION } from './terms';

export interface Profile {
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  /** The CGU and privacy policy version this user accepted, and when; null until they did. */
  termsVersion: string | null;
  termsAcceptedAt: string | null;
}

interface ProfileRow {
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  terms_version?: string | null;
  terms_accepted_at?: string | null;
}

const PROFILE_COLUMNS = 'first_name, last_name, photo_url, terms_version, terms_accepted_at';

function toProfile(row: ProfileRow): Profile {
  return {
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    photoUrl: row.photo_url,
    termsVersion: row.terms_version ?? null,
    termsAcceptedAt: row.terms_accepted_at ?? null,
  };
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
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data ? toProfile(data as ProfileRow) : null;
  }

  /** « J'accepte » on the app's new-terms screen: the version in force, at the server's time. */
  async acceptTerms(userId: string): Promise<Profile | null> {
    return this.writeProfile(userId, { terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() });
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

    return this.writeProfile(userId, patch);
  }

  private async writeProfile(userId: string, patch: Record<string, unknown>): Promise<Profile | null> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select(PROFILE_COLUMNS)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data ? toProfile(data as ProfileRow) : null;
  }
}
