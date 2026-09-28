import { Module } from '@nestjs/common';
import { DiscoveryModule } from '../discovery/discovery.module';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

@Module({
  imports: [DiscoveryModule],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
