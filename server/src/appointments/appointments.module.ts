import { Module } from '@nestjs/common';
import { CoiffeurModule } from '../coiffeur/coiffeur.module';
import { SalonModule } from '../salon/salon.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [CoiffeurModule, SalonModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
