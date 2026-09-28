import { Module } from '@nestjs/common';
import { AdminSettingsController } from './admin-settings.controller';
import { PlatformSettingsService } from './platform-settings.service';

@Module({
  controllers: [AdminSettingsController],
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class SettingsModule {}
