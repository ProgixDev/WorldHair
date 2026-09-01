import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { ContentService } from './content.service';
import { AppContentDto, toAppContentDto } from './dto/content.dto';
import { UpdateAppContentDto } from './dto/update-content.dto';

/**
 * "Gestion de contenu / pages" (TODO.md → Back-office admin, issue #5).
 * both admin tiers via `@Roles('admin', 'admin_limited')`, enforced by the global `RolesGuard`.
 */
@Roles('admin', 'admin_limited')
@Controller('admin/content')
export class AdminContentController {
  constructor(private readonly content: ContentService) {}

  @Get(':key')
  async get(@Param('key') key: string): Promise<AppContentDto> {
    return toAppContentDto(await this.content.get(key));
  }

  @Patch(':key')
  async update(
    @Param('key') key: string,
    @Body() dto: UpdateAppContentDto,
  ): Promise<AppContentDto> {
    return toAppContentDto(await this.content.update(key, dto));
  }
}
