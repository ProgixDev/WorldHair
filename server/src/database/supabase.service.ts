import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EnvironmentVariables } from '../config/env.validation';

/**
 * A single privileged Supabase client for server-side use, built with the
 * SERVICE ROLE key — which bypasses Row Level Security entirely so this
 * server can perform trusted operations (e.g. reading/writing any user's
 * `profiles` row on their behalf once `JwtAuthGuard` has already established
 * who they are).
 *
 * NEVER send SUPABASE_SERVICE_ROLE_KEY to a client (mobile/web app) — it must
 * only ever live on this server's environment. The mobile/web client builds
 * its OWN Supabase client with SUPABASE_URL + the publishable SUPABASE_ANON_KEY
 * (which respects RLS) and uses it directly for register/login/refresh/logout/
 * password-reset/email-verification — see `../auth/auth.module.ts` and
 * server/README.md for the full split of responsibilities.
 */
@Injectable()
export class SupabaseService {
  readonly client: SupabaseClient;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.client = createClient(
      config.get('SUPABASE_URL', { infer: true }),
      config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true }),
      // This is a server-only, short-lived-per-request client — it must never
      // try to persist or auto-refresh a session of its own.
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }
}
