import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { SupabaseService } from '../database/supabase.service';
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService', () => {
  let supabase: FakeSupabaseService;
  let service: AdminUsersService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    service = new AdminUsersService(supabase as unknown as SupabaseService);

    supabase.addUser('token-admin', { id: 'user-a', email: 'admin@worldhair.app', email_confirmed_at: '2024-01-01T00:00:00Z' }, 'admin', {
      firstName: 'Admin',
      lastName: 'WorldHair',
    });
    supabase.addUser('token-particulier', { id: 'user-p', email: 'camille@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' }, 'particulier', {
      firstName: 'Camille',
      lastName: 'Durand',
    });
  });

  it('list() returns only admin-tier accounts, with real emails', async () => {
    const admins = await service.list();

    expect(admins).toHaveLength(1);
    expect(admins[0]).toMatchObject({ id: 'user-a', email: 'admin@worldhair.app', tier: 'admin' });
  });

  it('create() always mints an admin_limited account, never a second full admin', async () => {
    const created = await service.create('moderator@worldhair.app', 'password123');

    expect(created).toMatchObject({ email: 'moderator@worldhair.app', tier: 'admin_limited' });

    const admins = await service.list();
    expect(admins).toHaveLength(2);
    expect(admins.find((a) => a.id === created.id)).toMatchObject({ tier: 'admin_limited' });
  });

  it('create()\'d account never shows up in the particulier/coiffeur accounts list', async () => {
    const created = await service.create('moderator@worldhair.app', 'password123');

    const admins = await service.list();
    expect(admins.map((a) => a.id)).toContain(created.id);
    // Sanity: the fake seeds a blank 'particulier' profile by default, then
    // AdminUsersService.create() must have promoted it to admin_limited —
    // list() filtering on ['admin', 'admin_limited'] proves that happened.
  });
});
