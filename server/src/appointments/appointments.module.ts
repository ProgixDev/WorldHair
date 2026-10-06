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
import { PresenceController } from './presence.controller';
import { PresenceService } from './presence.service';
import { StaffAppointmentsController } from './staff-appointments.controller';

@Module({
  imports: [CoiffeurModule, SalonModule, PaymentsModule, StaffModule],
  controllers: [AppointmentsController, AdminStatsController, AdminAppointmentsController, StaffAppointmentsController, PresenceController],
  providers: [AppointmentsService, AdminStatsService, AdminAppointmentsService, AppointmentPaymentsJob, NextSlotService, PresenceService],
  exports: [AppointmentsService, NextSlotService],
})
export class AppointmentsModule {}
