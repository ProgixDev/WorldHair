import { BadRequestException, Controller, Delete, HttpCode, InternalServerErrorException, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/types/role';
import { SupabaseService } from '../database/supabase.service';
import { AccountDeletionService } from './account-deletion.service';

/**
 * An account deleted from the back office (TODO.md Phase 8): a request
 * received by e-mail, or an account that can't reach the app's own button
 * (suspended, banned). The same deletion as the app's. The top admin tier
 * only; admin accounts go from Paramètres instead.
 */
@Roles('admin')
@Controller('admin/accounts')
export class AdminAccountDeletionController {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly deletion: AccountDeletionService,
  ) {}

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const { data, error } = await this.supabase.client.from('profiles').select('role').eq('id', id).maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    const role = (data as { role: Role } | null)?.role;
    if (!role) {
      throw new NotFoundException('Account not found');
    }
    if (role !== 'particulier' && role !== 'coiffeur') {
      throw new BadRequestException('An admin account is deleted from Paramètres');
    }
    await this.deletion.delete(id, role);
  }
}
