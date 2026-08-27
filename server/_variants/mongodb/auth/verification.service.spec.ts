import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MockCollaborator } from '../common/testing/mock-collaborator';
import { VerificationToken, VerificationTokenType } from './schemas/verification-token.schema';
import { VerificationService } from './verification.service';

describe('VerificationService', () => {
  let service: VerificationService;
  let tokenModel: MockCollaborator;
  let exec: jest.Mock;

  beforeEach(async () => {
    exec = jest.fn();
    tokenModel = { findOneAndUpdate: jest.fn().mockReturnValue({ exec }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        { provide: getModelToken(VerificationToken.name), useValue: tokenModel },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'VERIFY_TOKEN_TTL_HOURS'
                ? 24
                : key === 'RESET_TOKEN_TTL_MINUTES'
                  ? 60
                  : undefined,
          },
        },
      ],
    }).compile();

    service = module.get<VerificationService>(VerificationService);
  });

  it('issues a 6-digit numeric code', async () => {
    exec.mockResolvedValue({});

    const token = await service.issue('507f1f77bcf86cd799439011', VerificationTokenType.EmailVerify);

    expect(token).toMatch(/^\d{6}$/);
  });

  it('retries with a fresh code when the hash collides with another live token', async () => {
    exec.mockRejectedValueOnce({ code: 11000 }).mockResolvedValueOnce({});

    const token = await service.issue('507f1f77bcf86cd799439011', VerificationTokenType.EmailVerify);

    expect(token).toMatch(/^\d{6}$/);
    expect(tokenModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it('gives up after 3 collisions and rethrows', async () => {
    exec.mockRejectedValue({ code: 11000 });

    await expect(
      service.issue('507f1f77bcf86cd799439011', VerificationTokenType.EmailVerify),
    ).rejects.toEqual({ code: 11000 });
    expect(tokenModel.findOneAndUpdate).toHaveBeenCalledTimes(3);
  });

  it('rethrows a non-collision error immediately, without retrying', async () => {
    const error = new Error('Mongo connection lost');
    exec.mockRejectedValue(error);

    await expect(
      service.issue('507f1f77bcf86cd799439011', VerificationTokenType.EmailVerify),
    ).rejects.toThrow('Mongo connection lost');
    expect(tokenModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('consumes a valid unexpired token and returns the owning user id', async () => {
    const userId = '507f1f77bcf86cd799439011';
    exec.mockResolvedValue({ user: { toString: () => userId } });

    const result = await service.consume('482913', VerificationTokenType.PasswordReset);

    expect(result).toBe(userId);
  });

  it('returns null when the token is unknown, consumed, or expired', async () => {
    exec.mockResolvedValue(null);

    const result = await service.consume('482913', VerificationTokenType.PasswordReset);

    expect(result).toBeNull();
  });
});
