import { Module } from '@nestjs/common';
import { CoiffeurModule } from '../coiffeur/coiffeur.module';
import { PaymentsModule } from '../payments/payments.module';
import { SalonModule } from '../salon/salon.module';
import { StaffModule } from '../staff/staff.module';
import { AdminAppointmentsController } from './admin-appointments.controller';
import { AdminAppointmentsService } from './admin-appointments.service';
import { AdminStatsController } from './admin-stats.controller';
import { AdminStatsService } from './admin-stats.service';
import { AppointmentPaymentsJob } from './appointment-payments.job';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { NextSlotService } from './next-slot.service';
import { StaffAppointmentsController } from './staff-appointments.controller';

@Module({
  imports: [CoiffeurModule, SalonModule, PaymentsModule, StaffModule],
  controllers: [AppointmentsController, AdminStatsController, AdminAppointmentsController, StaffAppointmentsController],
  providers: [AppointmentsService, AdminStatsService, AdminAppointmentsService, AppointmentPaymentsJob, NextSlotService],
  exports: [AppointmentsService, NextSlotService],
})
export class AppointmentsModule {}
