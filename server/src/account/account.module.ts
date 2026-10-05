import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { PaymentsModule } from '../payments/payments.module';
import { StaffModule } from '../staff/staff.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AccountController } from './account.controller';
import { AccountDeletionService } from './account-deletion.service';
import { AdminAccountDeletionController } from './admin-account-deletion.controller';
import { DataExportService } from './data-export.service';

// No explicit SupabaseService import needed — DatabaseModule is @Global().
@Module({
  imports: [AppointmentsModule, PaymentsModule, SubscriptionsModule, StaffModule],
  controllers: [AccountController, AdminAccountDeletionController],
  providers: [AccountDeletionService, DataExportService],
})
export class AccountModule {}
