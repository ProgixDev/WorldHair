import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { SupabaseService } from '../database/supabase.service';
import { AdminAccountsService } from './admin-accounts.service';

describe('AdminAccountsService', () => {
  let supabase: FakeSupabaseService;
  let service: AdminAccountsService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    service = new AdminAccountsService(supabase as unknown as SupabaseService);

    supabase.addUser('token-particulier', { id: 'user-p', email: 'camille@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' }, 'particulier', {
      firstName: 'Camille',
      lastName: 'Durand',
    });
    supabase.addUser('token-coiffeur', { id: 'user-c', email: 'sofia@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' }, 'coiffeur', {
      firstName: 'Sofia',
      lastName: 'Benali',
    });
    supabase.addUser('token-admin', { id: 'user-a', email: 'admin@worldhair.app', email_confirmed_at: '2024-01-01T00:00:00Z' }, 'admin', {
      firstName: 'Admin',
      lastName: 'WorldHair',
    });
  });

  it('list() returns both particulier and coiffeur accounts, never admin, with their real email', async () => {
    const accounts = await service.list();

    expect(accounts).toHaveLength(2);
    expect(accounts.find((a) => a.id === 'user-a')).toBeUndefined();
    const camille = accounts.find((a) => a.id === 'user-p');
    expect(camille).toMatchObject({
      firstName: 'Camille',
      lastName: 'Durand',
      email: 'camille@example.com',
      accountStatus: 'active',
    });
  });

  it('list() filters by role', async () => {
    const accounts = await service.list('coiffeur');

    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe('user-c');
  });

  it('list() filters by search across name and email', async () => {
    const byName = await service.list(undefined, 'sofia');
    expect(byName.map((a) => a.id)).toEqual(['user-c']);

    const byEmail = await service.list(undefined, 'camille@example.com');
    expect(byEmail.map((a) => a.id)).toEqual(['user-p']);
  });

  it('getById() returns one account with its real email', async () => {
    const account = await service.getById('user-c');

    expect(account).toMatchObject({
      id: 'user-c',
      firstName: 'Sofia',
      lastName: 'Benali',
      email: 'sofia@example.com',
      role: 'coiffeur',
    });
  });

  it('getById() throws NotFoundException for an unknown id', async () => {
    await expect(service.getById('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('setStatus() suspends an account', async () => {
    const updated = await service.setStatus('user-p', 'suspended');

    expect(updated.accountStatus).toBe('suspended');
    const [account] = await service.list('particulier');
    expect(account.accountStatus).toBe('suspended');
  });

  it('setStatus() throws NotFoundException for an unknown id', async () => {
    await expect(
      service.setStatus('00000000-0000-0000-0000-000000000000', 'banned'),
    ).rejects.toThrow(NotFoundException);
  });

  it('setStatus() throws ForbiddenException for an admin account', async () => {
    await expect(service.setStatus('user-a', 'banned')).rejects.toThrow(ForbiddenException);
  });
});
