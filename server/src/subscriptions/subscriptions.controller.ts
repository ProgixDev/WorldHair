import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { ChangePlanDto } from './dto/change-plan.dto';
import { SubscriptionDto, toSubscriptionDto } from './dto/subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

/**
 * The coiffeur's own side of "Écran abonnement" (mobile) — no real payment
 * processing (Apple IAP / Google Play Billing, still TODO.md work), just
 * plan/status/dates.
 */
@Roles('coiffeur')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('mine')
  async getMine(@CurrentUser() current: AuthenticatedUser): Promise<SubscriptionDto> {
    return toSubscriptionDto(await this.subscriptions.getOrCreateMine(current.id));
  }

  @Patch('mine/plan')
  async changePlan(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: ChangePlanDto,
  ): Promise<SubscriptionDto> {
    return toSubscriptionDto(await this.subscriptions.changePlan(current.id, dto.plan));
  }

  @Patch('mine/cancel')
  async cancel(@CurrentUser() current: AuthenticatedUser): Promise<SubscriptionDto> {
    return toSubscriptionDto(await this.subscriptions.cancel(current.id));
  }

  @Patch('mine/reactivate')
  async reactivate(@CurrentUser() current: AuthenticatedUser): Promise<SubscriptionDto> {
    return toSubscriptionDto(await this.subscriptions.reactivate(current.id));
  }
}
