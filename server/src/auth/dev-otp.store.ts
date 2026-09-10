import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables, NodeEnv } from '../config/env.validation';

const TTL_MS = 10 * 60_000;

interface Entry {
  token: string;
  expiresAt: number;
}

/**
 * Dev-only convenience so signup can be tested without a real inbox: holds
 * the last signup OTP issued per email, in memory, so the mobile app's
 * verify-email screen can fetch and auto-fill it instead of you typing
 * whatever code you find in Render's logs.
 *
 * `set()` silently no-ops outside development — nothing is ever held in
 * memory in production, so there's no plaintext-OTP-in-RAM concern to reason
 * about there at all, independent of DevOtpController also refusing to serve
 * requests. Two separate gates for one feature that must never leak into a
 * real user's signup.
 */
@Injectable()
export class DevOtpStore {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  private get enabled(): boolean {
    return this.config.get('NODE_ENV', { infer: true }) !== NodeEnv.Production;
  }

  set(email: string, token: string): void {
    if (!this.enabled) return;
    this.entries.set(email.toLowerCase(), { token, expiresAt: Date.now() + TTL_MS });
  }

  /** One-time reveal: consumes the entry so a stale code can't be re-served. */
  take(email: string): string | null {
    if (!this.enabled) return null;

    const key = email.toLowerCase();
    const entry = this.entries.get(key);
    if (!entry) return null;

    this.entries.delete(key);
    return entry.expiresAt > Date.now() ? entry.token : null;
  }
}
