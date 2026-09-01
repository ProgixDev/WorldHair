import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { AdPlacementId, AdSlotsService } from './ad-slots.service';
import { AdSlotDto, toAdSlotDto } from './dto/ad-slot.dto';
import { UpdateAdSlotDto } from './dto/update-ad-slot.dto';

/**
 * "Gestion des zones publicitaires" (TODO.md → Back-office admin, issue #5).
 * both admin tiers via `@Roles('admin', 'admin_limited')`, enforced by the global `RolesGuard`.
 */
@Roles('admin', 'admin_limited')
@Controller('admin/ad-slots')
export class AdminAdSlotsController {
  constructor(private readonly adSlots: AdSlotsService) {}

  @Get()
  async list(): Promise<AdSlotDto[]> {
    return (await this.adSlots.listAll()).map(toAdSlotDto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: AdPlacementId,
    @Body() dto: UpdateAdSlotDto,
  ): Promise<AdSlotDto> {
    return toAdSlotDto(await this.adSlots.update(id, dto));
  }
}
