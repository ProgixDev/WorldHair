import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { AdminPaymentsController } from './admin-payments.controller';
import { PaymentsService } from './payments.service';
import { PayoutAccountsService } from './payout-accounts.service';
import { PayoutsController } from './payouts.controller';
import { PayoutsJob } from './payouts.job';

// No explicit SupabaseService/StripeService import needed — DatabaseModule and StripeModule are @Global().
@Module({
  imports: [SettingsModule],
  controllers: [PayoutsController, AdminPaymentsController],
  providers: [PaymentsService, PayoutAccountsService, PayoutsJob],
  exports: [PaymentsService, PayoutAccountsService],
})
export class PaymentsModule {}
