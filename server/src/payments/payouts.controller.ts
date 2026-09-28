import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PayoutAccountsService, PayoutStatus } from './payout-accounts.service';

/**
 * The coiffeur's "Paiements" screen: where their salon gets paid. Setting it
 * up and the Express dashboard both open on Stripe's own pages; this only
 * hands out the links and reads the result.
 */
@Roles('coiffeur')
@Controller('payments/connect')
export class PayoutsController {
  constructor(private readonly payouts: PayoutAccountsService) {}

  @Get('status')
  status(@CurrentUser() current: AuthenticatedUser): Promise<PayoutStatus> {
    return this.payouts.getStatus(current.id);
  }

  @Post('onboarding-link')
  @HttpCode(200)
  onboardingLink(@CurrentUser() current: AuthenticatedUser): Promise<{ url: string }> {
    return this.payouts.createOnboardingLink(current.id);
  }

  @Post('dashboard-link')
  @HttpCode(200)
  dashboardLink(@CurrentUser() current: AuthenticatedUser): Promise<{ url: string }> {
    return this.payouts.createDashboardLink(current.id);
  }
}
