import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { toPaginationOptions } from '../common/dto/pagination-query.dto';
import { DiscoveryService, SalonDetail, SalonSearchResult } from './discovery.service';
import { SearchSalonsQueryDto } from './dto/search-salons-query.dto';

/**
 * Particulier-facing salon search/discovery — TODO.md "Recherche &
 * géolocalisation". No `@Roles()`: open to any authenticated caller, same as
 * `/users/me`. `cities` is declared before `:id` so it isn't swallowed by
 * the param route.
 */
@Controller('salons')
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Get('cities')
  listCities(): Promise<string[]> {
    return this.discovery.listCities();
  }

  @Get()
  search(@Query() query: SearchSalonsQueryDto): Promise<SalonSearchResult> {
    return this.discovery.search({
      lat: query.lat,
      lng: query.lng,
      radiusKm: query.radiusKm,
      specialty: query.specialty,
      city: query.city,
      query: query.query,
      ...toPaginationOptions(query),
    });
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string): Promise<SalonDetail> {
    return this.discovery.getById(id);
  }
}
