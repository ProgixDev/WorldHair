import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { SupabaseStrategy } from './supabase.strategy';

interface ProfileResult {
  data: { role: string } | null;
  error: { message: string } | null;
}

function fakeSupabase(
  getUser: (token: string) => Promise<{ data: { user: unknown }; error: unknown }>,
  getProfile: () => Promise<ProfileResult> = async () => ({ data: { role: 'particulier' }, error: null }),
): SupabaseService {
  return {
    client: {
      auth: { getUser },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: getProfile }) }) }),
    },
  } as unknown as SupabaseService;
}

describe('SupabaseStrategy', () => {
  it('resolves an AuthenticatedUser from a valid token', async () => {
    const strategy = new SupabaseStrategy(
      fakeSupabase(async () => ({
        data: { user: { id: 'user-1', email: 'fan@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' } },
        error: null,
      })),
    );

    await expect(strategy.validate('good-token')).resolves.toEqual({
      id: 'user-1',
      email: 'fan@example.com',
      emailVerified: true,
      role: 'particulier',
    });
  });

  it('reports emailVerified: false when email_confirmed_at is null', async () => {
    const strategy = new SupabaseStrategy(
      fakeSupabase(async () => ({
        data: { user: { id: 'user-1', email: 'fan@example.com', email_confirmed_at: null } },
        error: null,
      })),
    );

    await expect(strategy.validate('good-token')).resolves.toEqual(
      expect.objectContaining({ emailVerified: false }),
    );
  });

  it("resolves the caller's role from the profiles row", async () => {
    const strategy = new SupabaseStrategy(
      fakeSupabase(
        async () => ({
          data: { user: { id: 'user-1', email: 'pro@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' } },
          error: null,
        }),
        async () => ({ data: { role: 'coiffeur' }, error: null }),
      ),
    );

    await expect(strategy.validate('good-token')).resolves.toEqual(
      expect.objectContaining({ role: 'coiffeur' }),
    );
  });

  it('falls back to particulier when no profile row exists yet', async () => {
    const strategy = new SupabaseStrategy(
      fakeSupabase(
        async () => ({
          data: { user: { id: 'user-1', email: 'fan@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' } },
          error: null,
        }),
        async () => ({ data: null, error: null }),
      ),
    );

    await expect(strategy.validate('good-token')).resolves.toEqual(
      expect.objectContaining({ role: 'particulier' }),
    );
  });

  it('throws InternalServerErrorException when the profile lookup errors', async () => {
    const strategy = new SupabaseStrategy(
      fakeSupabase(
        async () => ({
          data: { user: { id: 'user-1', email: 'fan@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' } },
          error: null,
        }),
        async () => ({ data: null, error: { message: 'connection lost' } }),
      ),
    );

    await expect(strategy.validate('good-token')).rejects.toThrow(InternalServerErrorException);
  });

  it('throws UnauthorizedException when Supabase reports an error', async () => {
    const strategy = new SupabaseStrategy(
      fakeSupabase(async () => ({ data: { user: null }, error: { message: 'invalid token' } })),
    );

    await expect(strategy.validate('bad-token')).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when there is no user and no error', async () => {
    const strategy = new SupabaseStrategy(fakeSupabase(async () => ({ data: { user: null }, error: null })));

    await expect(strategy.validate('bad-token')).rejects.toThrow(UnauthorizedException);
  });
});
