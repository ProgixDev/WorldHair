import { UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { SupabaseStrategy } from './supabase.strategy';

function fakeSupabase(
  getUser: (token: string) => Promise<{ data: { user: unknown }; error: unknown }>,
): SupabaseService {
  return { client: { auth: { getUser } } } as unknown as SupabaseService;
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
