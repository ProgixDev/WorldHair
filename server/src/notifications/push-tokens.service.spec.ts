import { SupabaseService } from '../database/supabase.service';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { PushTokensService } from './push-tokens.service';

const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';

describe('PushTokensService', () => {
  let supabase: FakeSupabaseService;
  let service: PushTokensService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    service = new PushTokensService(supabase as unknown as SupabaseService);
  });

  it('registers a token and lists it as active', async () => {
    await service.register(USER_ID, 'token-a', 'ios', 'Europe/Paris');
    await expect(service.listActiveForUser(USER_ID)).resolves.toEqual(['token-a']);
  });

  it('re-registering the same token to a different user moves it — the token, not (user, token), is the key', async () => {
    await service.register(USER_ID, 'shared-device-token', 'ios');
    await service.register(OTHER_USER_ID, 'shared-device-token', 'ios');

    await expect(service.listActiveForUser(USER_ID)).resolves.toEqual([]);
    await expect(service.listActiveForUser(OTHER_USER_ID)).resolves.toEqual(['shared-device-token']);
  });

  it('unregister only removes it for the caller — not from an account it no longer belongs to', async () => {
    await service.register(USER_ID, 'token-a', 'ios');
    await service.unregister(OTHER_USER_ID, 'token-a');
    await expect(service.listActiveForUser(USER_ID)).resolves.toEqual(['token-a']);

    await service.unregister(USER_ID, 'token-a');
    await expect(service.listActiveForUser(USER_ID)).resolves.toEqual([]);
  });

  it('invalidate soft-deletes — the token stops appearing as active without being removed', async () => {
    await service.register(USER_ID, 'token-a', 'ios');
    await service.invalidate('token-a');
    await expect(service.listActiveForUser(USER_ID)).resolves.toEqual([]);
  });
});
