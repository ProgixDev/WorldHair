import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
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

    return {
      id: data.user.id,
      email: data.user.email ?? '',
      emailVerified: data.user.email_confirmed_at != null,
    };
  }
}
