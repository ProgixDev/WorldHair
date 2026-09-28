import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { CoiffeurModule } from '../coiffeur/coiffeur.module';
import { PaymentsModule } from '../payments/payments.module';
import { SalonModule } from '../salon/salon.module';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';

@Module({
  imports: [CoiffeurModule, SalonModule, PaymentsModule, AppointmentsModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
