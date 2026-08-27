import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { SupabaseStrategy } from './strategies/supabase.strategy';

/**
 * Session issuance — register, login, refresh, logout, email verification,
 * forgot/reset password — is DELIBERATELY NOT implemented here. This variant
 * uses Supabase's own hosted Auth instead of this template's custom
 * bcrypt/refresh-token system: the mobile/web client talks to Supabase
 * directly via `@supabase/supabase-js` —
 * `auth.signUp()`, `auth.signInWithPassword()`, `auth.refreshSession()`,
 * `auth.signOut()`, `auth.resetPasswordForEmail()`, `auth.verifyOtp()` /
 * email-link confirmation — and gets back a Supabase-issued access token.
 *
 * This server's only auth-related job is verifying that token on incoming
 * requests and resolving who the caller is. See `guards/jwt-auth.guard.ts`
 * and `strategies/supabase.strategy.ts` for how, and `server/README.md` for
 * the full picture of which side (client vs this API) does what.
 */
@Module({
  providers: [SupabaseStrategy, JwtAuthGuard, OptionalJwtAuthGuard],
  // SupabaseStrategy must be exported too, not just the two guards:
  // app.module.ts (unchanged between variants) registers its OWN separate
  // `{ provide: APP_GUARD, useClass: JwtAuthGuard }` instance rather than
  // reusing this module's — Nest resolves that instance's constructor
  // dependencies (Reflector, SupabaseStrategy) from what AppModule can see,
  // which means SupabaseStrategy has to be visible outside this module.
  exports: [SupabaseStrategy, JwtAuthGuard, OptionalJwtAuthGuard],
})
export class AuthModule {}
