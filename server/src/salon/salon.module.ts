import { Module } from '@nestjs/common';
import { CoiffeurModule } from '../coiffeur/coiffeur.module';
import { CoiffeurProfileSeedListener } from './coiffeur-profile-seed.listener';
import { SalonController } from './salon.controller';
import { SalonService } from './salon.service';

// No explicit SupabaseService import needed — DatabaseModule is @Global().
@Module({
  imports: [CoiffeurModule],
  controllers: [SalonController],
  providers: [SalonService, CoiffeurProfileSeedListener],
  exports: [SalonService],
})
export class SalonModule {}
