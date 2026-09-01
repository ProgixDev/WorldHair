import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminAccountsService } from './admin-accounts.service';
import { AdminAccountDto, ListAccountsQueryDto, SetAccountStatusDto } from './dto/admin-account.dto';

/**
 * "Suspension / bannissement compte (particulier ou coiffeur)" (TODO.md ->
 * Back-office admin) — same module as the self-service `/users/me` since
 * both read/write the `profiles` table.
 */
@Roles('admin')
@Controller('admin/accounts')
export class AdminAccountsController {
  constructor(private readonly accounts: AdminAccountsService) {}

  @Get()
  list(@Query() query: ListAccountsQueryDto): Promise<AdminAccountDto[]> {
    return this.accounts.list(query.role, query.search);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAccountStatusDto,
  ): Promise<AdminAccountDto> {
    return this.accounts.setStatus(id, dto.status);
  }
}
