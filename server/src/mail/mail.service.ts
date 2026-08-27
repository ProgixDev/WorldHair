import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { EnvironmentVariables } from '../config/env.validation';
import { passwordResetMail, verificationMail } from './mail.templates';
import { buildMailTransport } from './mail.transport';

/**
 * Three transports, selected by `MAIL_TRANSPORT`:
 *
 * - `json` (default): renders the message instead of sending it — the dev/test
 *   default, no credentials needed.
 * - `smtp`: sends directly via nodemailer against `MAIL_HOST`/`MAIL_PORT`/etc.
 * - `relay`: POSTs the rendered mail as JSON to `MAIL_RELAY_URL` with an
 *   `x-mail-relay-secret` header, instead of sending it itself. This exists
 *   because some server hosts have unreliable outbound SMTP — relaying
 *   through another deployment (e.g. a `/api/mail` route on a web app hosted
 *   somewhere with reliable outbound mail, such as Vercel) sidesteps that
 *   entirely. The relay endpoint is expected to do the actual nodemailer send.
 */
@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter?: Transporter;

  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {
    const mode = config.get('MAIL_TRANSPORT', { infer: true });

    // Relay mode has no local SMTP client to reach — the relay endpoint sends
    // the mail instead, so no transporter is built for it. See sendViaRelay().
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

  onModuleDestroy(): void {
    this.transporter?.close();
  }

  private async send(
    to: string,
    mail: { subject: string; text: string; html: string },
  ): Promise<void> {
    const from = this.config.get('MAIL_FROM', { infer: true });

    try {
      if (this.config.get('MAIL_TRANSPORT', { infer: true }) === 'relay') {
        await this.sendViaRelay(from, to, mail);
      } else {
        await this.transporter!.sendMail({ from, to, ...mail });
      }
    } catch (error) {
      // A mail failure must not fail the HTTP request that triggered it.
      this.logger.error(`Failed to send "${mail.subject}" to ${to}`, error as Error);
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
