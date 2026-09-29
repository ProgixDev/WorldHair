import { Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
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

  /** The export as a file to download, for one too large for the phone's share sheet. */
  @Post('export/link')
  @HttpCode(200)
  exportLink(@CurrentUser() current: AuthenticatedUser): Promise<{ url: string; expiresAt: string }> {
    return this.exports.downloadLink(current);
  }
}
