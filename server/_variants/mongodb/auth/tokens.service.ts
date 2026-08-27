import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomUUID } from 'crypto';
import { Model, Types } from 'mongoose';
import { EnvironmentVariables } from '../config/env.validation';
import { RefreshToken } from './schemas/refresh-token.schema';
import { AccessTokenPayload, RefreshTokenPayload, TokenContext, TokenPair } from './token.types';

@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshToken>,
  ) {}

  async issuePair(
    userId: string,
    context: TokenContext,
    family: string = randomUUID(),
  ): Promise<TokenPair> {
    const accessToken = await this.signAccessToken(userId);
    const refreshToken = await this.signAndStoreRefreshToken(userId, family, context);

    return { accessToken, refreshToken };
  }

  async rotate(rawRefreshToken: string, context: TokenContext): Promise<TokenPair> {
    const payload = await this.verifyRefreshToken(rawRefreshToken);

    // Atomic claim: `revokedAt: null` in the filter means only one concurrent
    // request can ever successfully revoke a given still-valid token. Any other
    // concurrent attempt (or a genuine replay) gets `null` back here and falls
    // into the family-burn/reject path below, instead of a read-then-write race
    // letting two requests both mint a rotated pair from one single-use token.
    const stored = await this.refreshTokenModel
      .findOneAndUpdate(
        { tokenHash: this.hashToken(rawRefreshToken), revokedAt: null },
        { $set: { revokedAt: new Date() } },
      )
      .exec();

    if (!stored) {
      // Either forged, unknown, or already rotated: burn the family either way.
      await this.refreshTokenModel
        .updateMany(
          { family: payload.family, revokedAt: null },
          { $set: { revokedAt: new Date() } },
        )
        .exec();
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    return this.issuePair(payload.sub, context, payload.family);
  }

  async revoke(rawRefreshToken: string): Promise<void> {
    await this.refreshTokenModel
      .updateOne(
        { tokenHash: this.hashToken(rawRefreshToken), revokedAt: null },
        { $set: { revokedAt: new Date() } },
      )
      .exec();
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokenModel
      .updateMany(
        { user: new Types.ObjectId(userId), revokedAt: null },
        { $set: { revokedAt: new Date() } },
      )
      .exec();
  }

  private signAccessToken(userId: string): Promise<string> {
    const payload: AccessTokenPayload = { sub: userId, type: 'access' };

    return this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', { infer: true }),
    });
  }

  private async signAndStoreRefreshToken(
    userId: string,
    family: string,
    context: TokenContext,
  ): Promise<string> {
    const payload: RefreshTokenPayload = {
      sub: userId,
      jti: randomUUID(),
      family,
      type: 'refresh',
    };

    const token = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', { infer: true }),
    });

    const decoded = this.jwt.decode<{ exp: number }>(token);

    await this.refreshTokenModel.create({
      user: new Types.ObjectId(userId),
      tokenHash: this.hashToken(token),
      family,
      expiresAt: new Date(decoded.exp * 1000),
      userAgent: context.userAgent ?? null,
    });

    return token;
  }

  private async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Wrong token type');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  decodeAccessToken(token: string): AccessTokenPayload {
    return this.jwt.decode<AccessTokenPayload>(token);
  }
}
