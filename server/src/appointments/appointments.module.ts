import { Module } from '@nestjs/common';
import { CoiffeurModule } from '../coiffeur/coiffeur.module';
import { SalonModule } from '../salon/salon.module';
import { AdminStatsController } from './admin-stats.controller';
import { AdminStatsService } from './admin-stats.service';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [CoiffeurModule, SalonModule],
  controllers: [AppointmentsController, AdminStatsController],
  providers: [AppointmentsService, AdminStatsService],
})
export class AppointmentsModule {}
