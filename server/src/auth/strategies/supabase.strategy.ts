import { ForbiddenException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { Role } from '../../common/types/role';
import { SupabaseService } from '../../database/supabase.service';

/**
 * Not a passport strategy — deliberately. Supabase's own documented
 * server-side verification pattern is a direct `auth.getUser(token)` call
 * against Supabase's Auth server (see
 * https://supabase.com/docs/guides/auth/server-side/advanced-guide — "Do not
 * trust `getSession()`/local JWT decoding on a server; call `getUser()`
 * instead"): it validates the token against Supabase itself, which also
 * catches a session that's been revoked/signed-out, something a purely local
 * signature check would miss. That's a single async call/await, not a
 * local-verify-then-succeed shape, so it doesn't fit `passport-jwt`'s model —
 * and pulling in `@nestjs/passport` plus a custom-strategy package for one
 * method would be more dependency than this needs. `JwtAuthGuard` below calls
 * this directly instead.
 */
@Injectable()
export class SupabaseStrategy {
  constructor(private readonly supabase: SupabaseService) {}

  async validate(token: string): Promise<AuthenticatedUser> {
    const { data, error } = await this.supabase.client.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // `role`/`account_status` live on the `profiles` row (see schema.sql),
    // not in the Supabase Auth token itself — this is the one extra lookup
    // that costs every authenticated request, in exchange for `RolesGuard`
    // (and anything else reading `AuthenticatedUser.role`) never needing a
    // query of its own, and every route in this API enforcing suspension/
    // bans for free rather than each one remembering to check.
    const { data: profile, error: profileError } = await this.supabase.client
      .from('profiles')
      .select('role, account_status')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) {
      throw new InternalServerErrorException(profileError.message);
    }

    if (profile?.account_status === 'suspended' || profile?.account_status === 'banned') {
      throw new ForbiddenException('This account has been suspended.');
    }

    return {
      id: data.user.id,
      email: data.user.email ?? '',
      emailVerified: data.user.email_confirmed_at != null,
      // A missing row would mean the handle_new_user() trigger hasn't fired
      // yet for a brand-new signup; 'particulier' is the same default that
      // row would get, so this is a safe fallback rather than a real gap.
      role: (profile?.role as Role | undefined) ?? 'particulier',
    };
  }
}
