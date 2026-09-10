import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Webhook, WebhookVerificationError } from 'standardwebhooks';
import { EnvironmentVariables } from '../config/env.validation';
import { MailService } from '../mail/mail.service';
import { emailChangeMail, magicLinkMail, passwordResetLinkMail } from '../mail/mail.templates';
import { DevOtpStore } from './dev-otp.store';
import { EmailHookData, EmailHookPayload, EmailHookUser } from './email-hook.types';

interface WebhookHeaders {
  'webhook-id': string;
  'webhook-timestamp': string;
  'webhook-signature': string;
}

/**
 * Supabase's "Send Email" Auth Hook (Dashboard → Authentication → Auth
 * Hooks): once enabled there, Supabase stops sending its own auth emails and
 * instead POSTs the raw content here for this server to render and send —
 * which is what makes Resend the *only* mail path in the whole product (see
 * mail/mail.service.ts's doc comment). This still doesn't touch session
 * issuance itself (see auth.module.ts's doc comment) — signup/login/refresh
 * stay Supabase's job; this only intercepts the *email* Supabase would
 * otherwise send along the way.
 *
 * https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
 */
@Injectable()
export class EmailHookService {
  private readonly logger = new Logger(EmailHookService.name);

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly mail: MailService,
    private readonly devOtp: DevOtpStore,
  ) {}

  /**
   * Verifies the Standard Webhooks signature against the raw request body —
   * `payload` MUST be the exact bytes Supabase sent, not a re-serialized
   * `JSON.stringify(req.body)`, or the signature never matches.
   *
   * `SEND_EMAIL_HOOK_SECRET` may hold several `|`-separated secrets during
   * key rotation (Supabase's own recommended format is `v1,whsec_new|v1,
   * whsec_old`) — each is tried in turn so an in-flight rotation never 401s
   * a still-valid request signed with the old key.
   */
  verifyAndParse(payload: Buffer, headers: WebhookHeaders): EmailHookPayload {
    const configured = this.config.get('SEND_EMAIL_HOOK_SECRET', { infer: true });
    if (!configured) {
      throw new UnauthorizedException('SEND_EMAIL_HOOK_SECRET is not configured');
    }

    const secrets = configured
      .split('|')
      .map((secret) => secret.trim())
      .filter(Boolean);

    for (const secret of secrets) {
      try {
        // The library only strips a bare "whsec_" prefix itself — Supabase's
        // secret is "v1,whsec_...", so the leading "v1," has to go first.
        const key = secret.replace(/^v1,/, '');
        const result = new Webhook(key).verify(payload, headers);
        return result as EmailHookPayload;
      } catch (error) {
        if (error instanceof WebhookVerificationError) continue;
        throw error;
      }
    }

    throw new UnauthorizedException('Invalid webhook signature');
  }

  async dispatch(payload: EmailHookPayload): Promise<void> {
    const { user, email_data: data } = payload;

    switch (data.email_action_type) {
      case 'signup':
        // Dev convenience only — no-ops outside development, see
        // DevOtpStore's doc comment.
        this.devOtp.set(user.email, data.token);
        await this.mail.sendVerificationEmail(user.email, data.token);
        return;

      case 'email_change':
        await this.dispatchEmailChange(user, data);
        return;

      case 'magiclink':
        await this.mail.sendRendered(user.email, magicLinkMail(this.buildVerifyUrl(data)));
        return;

      case 'recovery':
        await this.mail.sendRendered(user.email, passwordResetLinkMail(this.buildVerifyUrl(data)));
        return;

      default:
        // invite, reauthentication, and the *_notification types have no
        // call site anywhere in this app today (no Supabase-issued invites,
        // no MFA) — logged rather than silently dropped, so a future flow
        // that DOES trigger one of these is loud about needing a template,
        // not a silent missing email.
        this.logger.warn(`No template for email_action_type "${data.email_action_type}" — not sent.`);
    }
  }

  private async dispatchEmailChange(user: EmailHookUser, data: EmailHookData): Promise<void> {
    for (const { to, tokenHash } of this.resolveEmailChangeRecipients(user, data)) {
      await this.mail.sendRendered(to, emailChangeMail(this.buildVerifyUrl(data, tokenHash)));
    }
  }

  /**
   * Supabase's own docs flag this pairing as easy to get backwards: the
   * `_new` suffix does NOT mean "goes to the new address". Verbatim from
   * Supabase's Send Email Hook guide —
   *
   *   Secure Email Change enabled (both pairs present):
   *     - current address (user.email):     token      + token_hash_new
   *     - new address     (user.new_email): token_new  + token_hash
   *   Secure Email Change disabled (one pair present):
   *     - single email to the new address, using whichever pair is set.
   */
  private resolveEmailChangeRecipients(
    user: EmailHookUser,
    data: EmailHookData,
  ): { to: string; tokenHash: string }[] {
    const secure = data.token_hash_new !== '' && data.token_hash !== '';

    if (secure) {
      return [
        { to: user.email, tokenHash: data.token_hash_new },
        { to: user.new_email ?? user.email, tokenHash: data.token_hash },
      ];
    }

    const tokenHash = data.token_hash !== '' ? data.token_hash : data.token_hash_new;
    if (!tokenHash) {
      throw new BadRequestException('email_change payload has no token hash to confirm with');
    }
    return [{ to: user.new_email ?? user.email, tokenHash }];
  }

  /**
   * Supabase's own `/auth/v1/verify` endpoint, not this app's site — the
   * hook payload's `site_url` is this app's URL (for building your OWN
   * link), not Supabase's; confirming the token still has to go through
   * Supabase itself. Query param is named `token` even though the value
   * passed is the *hash*, matching Supabase's own documented example.
   */
  private buildVerifyUrl(data: EmailHookData, tokenHashOverride?: string): string {
    const supabaseUrl = this.config.get('SUPABASE_URL', { infer: true });
    const params = new URLSearchParams({
      token: tokenHashOverride ?? data.token_hash,
      type: data.email_action_type,
      redirect_to: data.redirect_to,
    });
    return `${supabaseUrl}/auth/v1/verify?${params.toString()}`;
  }
}
