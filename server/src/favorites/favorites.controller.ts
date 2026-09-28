import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { SalonSummary } from '../discovery/discovery.service';
import { AddFavoriteDto, ListFavoritesQueryDto } from './dto/favorite.dto';
import { FavoritesService } from './favorites.service';

/** A client's hearts on salons (TODO.md Phase 6). */
@Roles('particulier')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@CurrentUser() current: AuthenticatedUser, @Query() query: ListFavoritesQueryDto): Promise<SalonSummary[]> {
    const origin = query.lat !== undefined && query.lng !== undefined ? { lat: query.lat, lng: query.lng } : undefined;
    return this.favorites.list(current.id, origin);
  }

  @Post()
  @HttpCode(204)
  add(@CurrentUser() current: AuthenticatedUser, @Body() dto: AddFavoriteDto): Promise<void> {
    return this.favorites.add(current.id, dto.coiffeurId);
  }

  @Delete(':coiffeurId')
  @HttpCode(204)
  remove(@CurrentUser() current: AuthenticatedUser, @Param('coiffeurId', ParseUUIDPipe) coiffeurId: string): Promise<void> {
    return this.favorites.remove(current.id, coiffeurId);
  }
}
