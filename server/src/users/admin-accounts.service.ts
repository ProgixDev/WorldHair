import { ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { AccountRole, AccountStatus, AdminAccountDto } from './dto/admin-account.dto';

interface ProfileRow {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  account_status: string;
  created_at: string;
}

/**
 * "Suspension / bannissement compte (particulier ou coiffeur)" (TODO.md ->
 * Back-office admin). The one real gate is `SupabaseStrategy.validate()`
 * (server/src/auth/strategies/supabase.strategy.ts), which every authenticated
 * request already goes through — this service only lists accounts and flips
 * the flag it reads.
 */
@Injectable()
export class AdminAccountsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(role?: AccountRole, search?: string): Promise<AdminAccountDto[]> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('id, first_name, last_name, role, account_status, created_at')
      .in('role', role ? [role] : ['particulier', 'coiffeur'])
      .order('created_at', { ascending: false });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const rows = data as ProfileRow[];
    const emailById = await this.emailsById(rows.map((row) => row.id));

    const accounts = rows.map((row) => this.toDto(row, emailById.get(row.id) ?? ''));

    if (!search) {
      return accounts;
    }
    const needle = search.toLowerCase();
    return accounts.filter(
      (account) =>
        `${account.firstName} ${account.lastName}`.toLowerCase().includes(needle) ||
        account.email.toLowerCase().includes(needle),
    );
  }

  async getById(id: string): Promise<AdminAccountDto> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('id, first_name, last_name, role, account_status, created_at')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException('Account not found.');
    }

    const emailById = await this.emailsById([id]);
    return this.toDto(data as ProfileRow, emailById.get(id) ?? '');
  }

  async setStatus(id: string, status: AccountStatus): Promise<AdminAccountDto> {
    const { data: existing, error: existingError } = await this.supabase.client
      .from('profiles')
      .select('id, first_name, last_name, role, account_status, created_at')
      .eq('id', id)
      .maybeSingle();
    if (existingError) {
      throw new InternalServerErrorException(existingError.message);
    }
    if (!existing) {
      throw new NotFoundException('Account not found.');
    }
    if ((existing as ProfileRow).role === 'admin') {
      throw new ForbiddenException('Admin accounts cannot be moderated through this endpoint.');
    }

    const { data, error } = await this.supabase.client
      .from('profiles')
      .update({ account_status: status })
      .eq('id', id)
      .select('id, first_name, last_name, role, account_status, created_at')
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const emailById = await this.emailsById([id]);
    return this.toDto(data as ProfileRow, emailById.get(id) ?? '');
  }

  /** No `admin.getUserByEmail`/bulk-by-id lookup in supabase-js — page through
   * `listUsers` once and keep only the ids this call cares about, same
   * approach as scripts/seed-demo-accounts.ts's `findExistingUserId`. */
  private async emailsById(ids: string[]): Promise<Map<string, string>> {
    const wanted = new Set(ids);
    const result = new Map<string, string>();
    let page = 1;
    for (;;) {
      const { data, error } = await this.supabase.client.auth.admin.listUsers({ page, perPage: 200 });
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
      for (const user of data.users) {
        if (wanted.has(user.id)) {
          result.set(user.id, user.email ?? '');
        }
      }
      if (data.users.length < 200 || result.size === wanted.size) {
        return result;
      }
      page += 1;
    }
  }

  private toDto(row: ProfileRow, email: string): AdminAccountDto {
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email,
      role: row.role as AccountRole,
      accountStatus: row.account_status as AccountStatus,
      createdAt: row.created_at,
    };
  }
}
