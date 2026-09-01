import { Controller, Get } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminSubscriptionSummaryDto, toAdminSubscriptionSummaryDto } from './dto/subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

/**
 * "Vue abonnements coiffeurs (statut, échéance)" (TODO.md → Back-office
 * admin) — read-only, no admin override of a coiffeur's plan.
 * `@Roles('admin')` is enforced by the global `RolesGuard`.
 */
@Roles('admin')
@Controller('admin/subscriptions')
export class AdminSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  async list(): Promise<AdminSubscriptionSummaryDto[]> {
    return (await this.subscriptions.listAllForAdmin()).map(toAdminSubscriptionSummaryDto);
  }
}
