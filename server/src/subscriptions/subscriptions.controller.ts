import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateCheckoutSessionDto } from './dto/subscription.dto';
import { PlanPrice, SubscriptionsService, SubscriptionView } from './subscriptions.service';

/**
 * The coiffeur's subscription. The app only reads it (`mine`); the website
 * sells and manages it through Stripe (checkout-session, portal-session).
 */
@Roles('coiffeur')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('mine')
  getMine(@CurrentUser() current: AuthenticatedUser): Promise<SubscriptionView> {
    return this.subscriptions.getMine(current.id);
  }

  @Get('prices')
  listPrices(): Promise<PlanPrice[]> {
    return this.subscriptions.listPrices();
  }

  @Post('checkout-session')
  createCheckoutSession(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: CreateCheckoutSessionDto,
  ): Promise<{ url: string }> {
    return this.subscriptions.createCheckoutSession(current.id, dto.tier ?? 'solo', dto.plan);
  }

  @Post('portal-session')
  createPortalSession(@CurrentUser() current: AuthenticatedUser): Promise<{ url: string }> {
    return this.subscriptions.createPortalSession(current.id);
  }
}
