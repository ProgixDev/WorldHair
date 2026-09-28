import { Module } from '@nestjs/common';
import { CoiffeurModule } from '../coiffeur/coiffeur.module';
import { PaymentsModule } from '../payments/payments.module';
import { SalonModule } from '../salon/salon.module';
import { AdminStatsController } from './admin-stats.controller';
import { AdminStatsService } from './admin-stats.service';
import { AppointmentPaymentsJob } from './appointment-payments.job';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [CoiffeurModule, SalonModule, PaymentsModule],
  controllers: [AppointmentsController, AdminStatsController],
  providers: [AppointmentsService, AdminStatsService, AppointmentPaymentsJob],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
