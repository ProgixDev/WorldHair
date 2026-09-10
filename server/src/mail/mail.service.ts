import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { EnvironmentVariables } from '../config/env.validation';
import { coiffeurApplicationDecidedMail, passwordResetMail, verificationMail } from './mail.templates';
import { buildMailTransport } from './mail.transport';

/**
 * Four transports, selected by `MAIL_TRANSPORT`:
 *
 * - `json` (default): renders the message instead of sending it — the dev/test
 *   default, no credentials needed.
 * - `smtp`: sends directly via nodemailer against `MAIL_HOST`/`MAIL_PORT`/etc.
 * - `resend`: POSTs to Resend's HTTPS API. **This is the production transport.**
 *   Render blocks outbound SMTP ports (25/465/587) on its free tier, so
 *   `smtp` cannot work there at all — and neither can `relay`, since the web
 *   app it would relay through is on Render too. HTTPS is the only way out,
 *   which is what this does.
 * - `relay`: POSTs the rendered mail as JSON to `MAIL_RELAY_URL` with an
 *   `x-mail-relay-secret` header, letting another deployment do the actual
 *   nodemailer send. Only useful when that other host has working outbound
 *   SMTP — prefer `resend` unless you specifically have such a host.
 */
@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter?: Transporter;

  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {
    const mode = config.get('MAIL_TRANSPORT', { infer: true });

    // Neither HTTP transport builds a nodemailer client — they POST the
    // rendered mail instead. See sendViaResend() / sendViaRelay().
    if (mode === 'resend') {
      if (!config.get('RESEND_API_KEY', { infer: true })) {
        throw new Error('RESEND_API_KEY is required when MAIL_TRANSPORT=resend');
      }
      return;
    }

    if (mode === 'relay') {
      if (
        !config.get('MAIL_RELAY_URL', { infer: true }) ||
        !config.get('MAIL_RELAY_SECRET', { infer: true })
      ) {
        throw new Error(
          'MAIL_RELAY_URL and MAIL_RELAY_SECRET are required when MAIL_TRANSPORT=relay',
        );
      }
      return;
    }

    this.transporter = createTransport(
      buildMailTransport({
        MAIL_TRANSPORT: mode,
        MAIL_HOST: config.get('MAIL_HOST', { infer: true }),
        MAIL_PORT: config.get('MAIL_PORT', { infer: true }),
        MAIL_SECURE: config.get('MAIL_SECURE', { infer: true }),
        MAIL_USER: config.get('MAIL_USER', { infer: true }),
        MAIL_PASSWORD: config.get('MAIL_PASSWORD', { infer: true }),
      }) as Parameters<typeof createTransport>[0],
    );
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const ttlHours = this.config.get('VERIFY_TOKEN_TTL_HOURS', { infer: true });

    await this.send(to, verificationMail(token, ttlHours));
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const ttlMinutes = this.config.get('RESET_TOKEN_TTL_MINUTES', { infer: true });

    await this.send(to, passwordResetMail(token, ttlMinutes));
  }

  async sendCoiffeurApplicationDecidedEmail(
    to: string,
    status: 'validated' | 'rejected',
    reviewMessage?: string | null,
  ): Promise<void> {
    await this.send(to, coiffeurApplicationDecidedMail(status, reviewMessage));
  }

  onModuleDestroy(): void {
    this.transporter?.close();
  }

  private async send(
    to: string,
    mail: { subject: string; text: string; html: string },
  ): Promise<void> {
    const from = this.config.get('MAIL_FROM', { infer: true });

    const mode = this.config.get('MAIL_TRANSPORT', { infer: true });

    try {
      if (mode === 'resend') {
        await this.sendViaResend(from, to, mail);
      } else if (mode === 'relay') {
        await this.sendViaRelay(from, to, mail);
      } else {
        await this.transporter!.sendMail({ from, to, ...mail });
      }
    } catch (error) {
      // A mail failure must not fail the HTTP request that triggered it.
      this.logger.error(`Failed to send "${mail.subject}" to ${to}`, error as Error);
    }
  }

  /**
   * Resend's HTTPS API (POST https://api.resend.com/emails). `to` is an array
   * per its schema even for a single recipient. A non-2xx carries a JSON body
   * explaining why — surfaced in the thrown message so the logged failure in
   * `send()` says something more useful than the bare status code.
   */
  private async sendViaResend(
    from: string,
    to: string,
    mail: { subject: string; text: string; html: string },
  ): Promise<void> {
    const apiKey = this.config.get('RESEND_API_KEY', { infer: true });

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to: [to], ...mail }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Resend responded with ${res.status}${detail ? `: ${detail}` : ''}`);
    }
  }

  private async sendViaRelay(
    from: string,
    to: string,
    mail: { subject: string; text: string; html: string },
  ): Promise<void> {
    const url = this.config.get('MAIL_RELAY_URL', { infer: true });
    const secret = this.config.get('MAIL_RELAY_SECRET', { infer: true });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-mail-relay-secret': secret },
      body: JSON.stringify({ from, to, ...mail }),
    });

    if (!res.ok) {
      throw new Error(`Mail relay responded with ${res.status}`);
    }
  }
}
