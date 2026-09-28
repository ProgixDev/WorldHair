import { Controller, Get } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminSubscriptionSummary, SubscriptionsService } from './subscriptions.service';

/**
 * "Vue abonnements coiffeurs (statut, échéance)" — read-only: Stripe is where
 * a subscription changes, and each row links to its customer there. Both
 * admin tiers via `@Roles('admin', 'admin_limited')`, enforced by the global
 * `RolesGuard`.
 */
@Roles('admin', 'admin_limited')
@Controller('admin/subscriptions')
export class AdminSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  list(): Promise<AdminSubscriptionSummary[]> {
    return this.subscriptions.listAllForAdmin();
  }
}
