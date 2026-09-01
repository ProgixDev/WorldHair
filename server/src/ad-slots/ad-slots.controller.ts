import { Controller, Get } from '@nestjs/common';
import { AdSlotsService } from './ad-slots.service';
import { AdSlotDto, toAdSlotDto } from './dto/ad-slot.dto';

/**
 * What `mobile/src/services/ads.ts` will call once wired to the real API.
 * No `@Roles()`: any authenticated caller (particulier browsing, coiffeur —
 * though only particulier screens render ad slots today) can read these.
 */
@Controller('ad-slots')
export class AdSlotsController {
  constructor(private readonly adSlots: AdSlotsService) {}

  @Get()
  async list(): Promise<AdSlotDto[]> {
    return (await this.adSlots.listAll()).map(toAdSlotDto);
  }
}
