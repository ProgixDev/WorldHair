import { InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { TERMS_VERSION } from './terms';
import { UsersService } from './users.service';

interface QueryResult {
  data: unknown;
  error: { code?: string; message: string } | null;
}

/** A minimal double for the `.from('profiles')...` chain UsersService uses. */
function fakeSupabase(select: () => QueryResult, update: () => QueryResult): SupabaseService {
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => select() }) }),
      update: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => update() }) }) }),
    }),
  };
  return { client } as unknown as SupabaseService;
}

describe('UsersService', () => {
  it('getProfile() maps a found row', async () => {
    const service = new UsersService(
      fakeSupabase(
        () => ({ data: { first_name: 'Camille', last_name: 'Durand', photo_url: null }, error: null }),
        () => ({ data: null, error: null }),
      ),
    );

    await expect(service.getProfile('user-1')).resolves.toEqual({
      firstName: 'Camille',
      lastName: 'Durand',
      photoUrl: null,
      termsVersion: null,
      termsAcceptedAt: null,
    });
  });

  it('getProfile() returns null when no row exists', async () => {
    const service = new UsersService(fakeSupabase(() => ({ data: null, error: null }), () => ({ data: null, error: null })));

    await expect(service.getProfile('user-1')).resolves.toBeNull();
  });

  it('getProfile() throws on a Supabase error', async () => {
    const service = new UsersService(
      fakeSupabase(() => ({ data: null, error: { message: 'connection lost' } }), () => ({ data: null, error: null })),
    );

    await expect(service.getProfile('user-1')).rejects.toThrow(InternalServerErrorException);
  });

  it('updateProfile() returns the updated row', async () => {
    const service = new UsersService(
      fakeSupabase(
        () => ({ data: null, error: null }),
        () => ({ data: { first_name: 'Camille', last_name: 'Durand', photo_url: 'https://example.com/a.jpg' }, error: null }),
      ),
    );

    await expect(
      service.updateProfile('user-1', { firstName: 'Camille', lastName: 'Durand', photoUrl: 'https://example.com/a.jpg' }),
    ).resolves.toEqual({
      firstName: 'Camille',
      lastName: 'Durand',
      photoUrl: 'https://example.com/a.jpg',
      termsVersion: null,
      termsAcceptedAt: null,
    });
  });

  it('updateProfile() surfaces a Supabase error', async () => {
    const service = new UsersService(
      fakeSupabase(
        () => ({ data: null, error: null }),
        () => ({ data: null, error: { message: 'connection lost' } }),
      ),
    );

    await expect(service.updateProfile('user-1', { firstName: 'Camille' })).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  describe('terms (TODO.md Phase 8)', () => {
    let supabase: FakeSupabaseService;
    let service: UsersService;

    beforeEach(() => {
      supabase = new FakeSupabaseService();
      service = new UsersService(supabase as unknown as SupabaseService);
      supabase.addUser('token', { id: 'user-1', email: 'camille@example.com', email_confirmed_at: null }, 'particulier', {
        firstName: 'Camille',
        lastName: 'Durand',
      });
    });

    it('reads the version accepted at sign-up, and when', async () => {
      supabase.seedTermsAcceptance('user-1', '2025-01-01', '2025-01-02T10:00:00.000Z');

      await expect(service.getProfile('user-1')).resolves.toMatchObject({
        termsVersion: '2025-01-01',
        termsAcceptedAt: '2025-01-02T10:00:00.000Z',
      });
    });

    it('records the acceptance of the version in force, now', async () => {
      const before = Date.now();

      const profile = await service.acceptTerms('user-1');

      expect(profile).toMatchObject({ termsVersion: TERMS_VERSION });
      expect(new Date(profile!.termsAcceptedAt!).getTime()).toBeGreaterThanOrEqual(before);
      expect(supabase.profileFor('user-1')).toMatchObject({ terms_version: TERMS_VERSION });
    });
  });

  it('updateProfile() returns null when the profile row does not exist', async () => {
    const service = new UsersService(
      fakeSupabase(() => ({ data: null, error: null }), () => ({ data: null, error: null })),
    );

    await expect(service.updateProfile('user-1', { lastName: 'Durand' })).resolves.toBeNull();
  });
});
