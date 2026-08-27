import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomInt } from 'crypto';
import { Model, Types } from 'mongoose';
import { EnvironmentVariables } from '../config/env.validation';
import { VerificationToken, VerificationTokenType } from './schemas/verification-token.schema';

const MAX_ISSUE_ATTEMPTS = 3;

/**
 * Issues and consumes the one-time 6-digit codes used for email verification
 * and password reset. Shared by both flows because the storage and
 * hash/expire/consume mechanics are identical — only the TTL differs.
 */
@Injectable()
export class VerificationService {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    @InjectModel(VerificationToken.name)
    private readonly tokenModel: Model<VerificationToken>,
  ) {}

  /** Returns the raw 6-digit code — the only place it exists in plaintext. */
  async issue(userId: string, type: VerificationTokenType): Promise<string> {
    const user = new Types.ObjectId(userId);

    for (let attempt = 1; attempt <= MAX_ISSUE_ATTEMPTS; attempt++) {
      const token = randomInt(100_000, 1_000_000).toString();

      try {
        // Atomic upsert on (user, type): overwriting tokenHash/expiresAt/consumedAt in
        // place is what makes any previously-issued token for this pair instantly
        // unusable (its hash no longer matches anything stored) — no separate
        // invalidate-then-create step, so there's no read-then-write window for two
        // concurrent issues to both succeed.
        await this.tokenModel
          .findOneAndUpdate(
            { user, type },
            {
              $set: { tokenHash: this.hash(token), expiresAt: this.expiryFor(type), consumedAt: null },
            },
            { upsert: true },
          )
          .exec();

        return token;
      } catch (error) {
        // tokenHash is globally unique across all users — a 6-digit code has real
        // odds of colliding with someone else's currently live code. Retry with a
        // fresh code; any other error propagates immediately.
        const isDuplicateHash = (error as { code?: number })?.code === 11000;
        if (!isDuplicateHash || attempt === MAX_ISSUE_ATTEMPTS) {
          throw error;
        }
      }
    }

    // Unreachable: the loop above always returns or throws.
    throw new Error('Failed to issue a unique verification code');
  }

  /** Returns the owning user id, or null when the token is unusable. */
  async consume(token: string, type: VerificationTokenType): Promise<string | null> {
    const consumed = await this.tokenModel
      .findOneAndUpdate(
        {
          tokenHash: this.hash(token),
          type,
          consumedAt: null,
          expiresAt: { $gt: new Date() },
        },
        { $set: { consumedAt: new Date() } },
        { returnDocument: 'after' },
      )
      .exec();

    return consumed ? consumed.user.toString() : null;
  }

  private expiryFor(type: VerificationTokenType): Date {
    const ms =
      type === VerificationTokenType.EmailVerify
        ? this.config.get('VERIFY_TOKEN_TTL_HOURS', { infer: true }) * 3_600_000
        : this.config.get('RESET_TOKEN_TTL_MINUTES', { infer: true }) * 60_000;

    return new Date(Date.now() + ms);
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
