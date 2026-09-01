import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { AdminTier, AdminUserDto } from './dto/admin-user.dto';

interface ProfileRow {
  id: string;
  role: string;
  created_at: string;
}

/**
 * "Gestion des admins" (web `/admin/parametres`): letting a full admin
 * create a lower-privilege one. `admin_limited` has every other admin
 * capability (see `common/types/role.ts`) — only this module, gated
 * `@Roles('admin')` alone (no `admin_limited`), is exclusive to the top tier.
 */
@Injectable()
export class AdminUsersService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(): Promise<AdminUserDto[]> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('id, role, created_at')
      .in('role', ['admin', 'admin_limited'])
      .order('created_at', { ascending: false });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const rows = data as ProfileRow[];
    const emailById = await this.emailsById(rows.map((row) => row.id));

    return rows.map((row) => ({
      id: row.id,
      email: emailById.get(row.id) ?? '',
      tier: row.role as AdminTier,
      createdAt: row.created_at,
    }));
  }

  /** Always creates an `admin_limited` account — never a second full admin, regardless of what's passed in. */
  async create(email: string, password: string): Promise<AdminUserDto> {
    const { data, error } = await this.supabase.client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      throw new BadRequestException(error.message);
    }

    const { data: profile, error: profileError } = await this.supabase.client
      .from('profiles')
      .update({ role: 'admin_limited' })
      .eq('id', data.user.id)
      .select('id, role, created_at')
      .maybeSingle();
    if (profileError) {
      throw new InternalServerErrorException(profileError.message);
    }
    const row = profile as ProfileRow | null;

    return {
      id: data.user.id,
      email,
      tier: 'admin_limited',
      createdAt: row?.created_at ?? new Date().toISOString(),
    };
  }

  /** Same paginated lookup as AdminAccountsService.emailsById — no bulk-by-id lookup in supabase-js. */
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
}
