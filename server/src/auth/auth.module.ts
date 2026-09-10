import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { EmailHookController } from './email-hook.controller';
import { EmailHookService } from './email-hook.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { SupabaseStrategy } from './strategies/supabase.strategy';

/**
 * Session issuance — register, login, refresh, logout — is DELIBERATELY NOT
 * implemented here. This variant uses Supabase's own hosted Auth instead of
 * this template's custom bcrypt/refresh-token system: the mobile/web client
 * talks to Supabase directly via `@supabase/supabase-js` —
 * `auth.signUp()`, `auth.signInWithPassword()`, `auth.refreshSession()`,
 * `auth.signOut()`, `auth.resetPasswordForEmail()`, `auth.verifyOtp()` /
 * email-link confirmation — and gets back a Supabase-issued access token.
 *
 * This server's own auth-related job is still just verifying that token on
 * incoming requests and resolving who the caller is — see
 * `guards/jwt-auth.guard.ts` and `strategies/supabase.strategy.ts` — plus
 * one addition: `EmailHookController`/`EmailHookService` receive Supabase's
 * "Send Email" Auth Hook, so every auth email (signup code, email-change
 * confirmation, etc.) is actually sent by this server via Resend rather than
 * Supabase's own mailer. That's mail delivery, not session issuance — see
 * `email-hook.service.ts`'s doc comment for the full picture, and
 * `server/README.md` for which side (client vs this API) does what overall.
 */
@Module({
  imports: [MailModule],
  controllers: [EmailHookController],
  providers: [SupabaseStrategy, JwtAuthGuard, OptionalJwtAuthGuard, EmailHookService],
  // SupabaseStrategy must be exported too, not just the two guards:
  // app.module.ts (unchanged between variants) registers its OWN separate
  // `{ provide: APP_GUARD, useClass: JwtAuthGuard }` instance rather than
  // reusing this module's — Nest resolves that instance's constructor
  // dependencies (Reflector, SupabaseStrategy) from what AppModule can see,
  // which means SupabaseStrategy has to be visible outside this module.
  exports: [SupabaseStrategy, JwtAuthGuard, OptionalJwtAuthGuard],
})
export class AuthModule {}
