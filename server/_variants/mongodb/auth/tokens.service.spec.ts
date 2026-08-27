import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EnvironmentVariables } from '../config/env.validation';
import { MockCollaborator } from '../common/testing/mock-collaborator';
import { TokensService } from './tokens.service';

const CONFIG = {
  JWT_ACCESS_SECRET: 'a'.repeat(40),
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'b'.repeat(40),
  JWT_REFRESH_EXPIRES_IN: '30d',
} as const;

function fakeConfig(): ConfigService<EnvironmentVariables, true> {
  return { get: (key: keyof typeof CONFIG) => CONFIG[key] } as unknown as ConfigService<
    EnvironmentVariables,
    true
  >;
}

describe('TokensService', () => {
  let model: MockCollaborator;
  let service: TokensService;
  const userId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    model = {
      create: jest.fn().mockResolvedValue({}),
      findOneAndUpdate: jest.fn(),
      updateMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    };

    // A real JwtService (no Nest DI needed to construct it) — signing and
    // verifying real JWTs is what actually exercises TokensService's logic,
    // rather than a mock that would just echo back canned values.
    service = new TokensService(new JwtService({}), fakeConfig(), model as never);
  });

  it('issues an access token and persists a hashed refresh token', async () => {
    const pair = await service.issuePair(userId, { userAgent: 'jest' });

    expect(pair.accessToken.split('.')).toHaveLength(3);
    expect(pair.refreshToken.split('.')).toHaveLength(3);
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash: expect.any(String),
        userAgent: 'jest',
      }),
    );
    // The raw token is never what gets persisted.
    const persisted = model.create.mock.calls[0][0] as { tokenHash: string };
    expect(persisted.tokenHash).not.toBe(pair.refreshToken);
  });

  it('rotates a valid, unrevoked refresh token for a fresh pair', async () => {
    model.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });

    const first = await service.issuePair(userId, { userAgent: 'jest' });
    const second = await service.rotate(first.refreshToken, { userAgent: 'jest' });

    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(model.updateMany).not.toHaveBeenCalled();
  });

  it('rejects and burns the family when the token was already rotated/revoked', async () => {
    model.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

    const first = await service.issuePair(userId, { userAgent: 'jest' });

    await expect(service.rotate(first.refreshToken, { userAgent: 'jest' })).rejects.toThrow(
      UnauthorizedException,
    );
    expect(model.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ revokedAt: null }),
      expect.objectContaining({ $set: { revokedAt: expect.any(Date) } }),
    );
  });

  it('rejects a garbage refresh token without touching the model', async () => {
    await expect(service.rotate('not-a-jwt', { userAgent: 'jest' })).rejects.toThrow(
      UnauthorizedException,
    );
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('revoke() updates only the matching, still-live token', async () => {
    await service.revoke('some-token');

    expect(model.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: expect.any(String), revokedAt: null }),
      { $set: { revokedAt: expect.any(Date) } },
    );
  });

  it('revokeAllForUser() updates every live token for that user', async () => {
    await service.revokeAllForUser(userId);

    expect(model.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ revokedAt: null }),
      { $set: { revokedAt: expect.any(Date) } },
    );
  });

  it('decodeAccessToken() reads back the payload without verifying signature', async () => {
    const pair = await service.issuePair(userId, {});

    expect(service.decodeAccessToken(pair.accessToken)).toEqual(
      expect.objectContaining({ sub: userId, type: 'access' }),
    );
  });
});
