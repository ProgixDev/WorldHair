import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { PlatformSettings, PlatformSettingsService } from './platform-settings.service';

/** /admin/parametres → "Période d'essai". Both admin tiers, like the rest of the back-office. */
@Roles('admin', 'admin_limited')
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get()
  get(): Promise<PlatformSettings> {
    return this.settings.get();
  }

  @Patch()
  update(@Body() dto: UpdatePlatformSettingsDto): Promise<PlatformSettings> {
    return this.settings.update(dto);
  }
}
