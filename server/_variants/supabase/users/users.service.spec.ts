import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
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
        () => ({ data: { username: 'whale_fan', display_name: 'Fan' }, error: null }),
        () => ({ data: null, error: null }),
      ),
    );

    await expect(service.getProfile('user-1')).resolves.toEqual({
      username: 'whale_fan',
      displayName: 'Fan',
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
        () => ({ data: { username: 'whale_fan', display_name: 'Fan' }, error: null }),
      ),
    );

    await expect(service.updateProfile('user-1', { username: 'whale_fan', displayName: 'Fan' })).resolves.toEqual({
      username: 'whale_fan',
      displayName: 'Fan',
    });
  });

  it('updateProfile() surfaces a duplicate username as a 409', async () => {
    const service = new UsersService(
      fakeSupabase(
        () => ({ data: null, error: null }),
        () => ({ data: null, error: { code: '23505', message: 'duplicate key value' } }),
      ),
    );

    await expect(service.updateProfile('user-1', { username: 'taken' })).rejects.toThrow(ConflictException);
  });

  it('updateProfile() returns null when the profile row does not exist', async () => {
    const service = new UsersService(
      fakeSupabase(() => ({ data: null, error: null }), () => ({ data: null, error: null })),
    );

    await expect(service.updateProfile('user-1', { displayName: 'Fan' })).resolves.toBeNull();
  });
});
