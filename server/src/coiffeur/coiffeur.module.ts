import { Module } from '@nestjs/common';
import { AdminCoiffeurApplicationsController } from './admin-coiffeur-applications.controller';
import { CoiffeurApplicationsController } from './coiffeur-applications.controller';
import { CoiffeurApplicationsService } from './coiffeur-applications.service';

// No explicit SupabaseService import needed — DatabaseModule is @Global().
@Module({
  controllers: [CoiffeurApplicationsController, AdminCoiffeurApplicationsController],
  providers: [CoiffeurApplicationsService],
  exports: [CoiffeurApplicationsService],
})
export class CoiffeurModule {}
