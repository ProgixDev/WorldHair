import { Controller, Delete, Get, HttpCode } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { AccountDeletionService } from './account-deletion.service';
import { DataExport, DataExportService } from './data-export.service';

/**
 * The app's « Mes données » (TODO.md Phase 8): delete the account, export
 * its data. Clients and salons — an admin account goes from the back
 * office's own page instead.
 */
@Roles('particulier', 'coiffeur')
@Controller('users/me')
export class AccountController {
  constructor(
    private readonly deletion: AccountDeletionService,
    private readonly exports: DataExportService,
  ) {}

  @Delete()
  @HttpCode(204)
  async delete(@CurrentUser() current: AuthenticatedUser): Promise<void> {
    await this.deletion.delete(current.id, current.role);
  }

  @Get('export')
  export(@CurrentUser() current: AuthenticatedUser): Promise<DataExport> {
    return this.exports.export(current);
  }
}
