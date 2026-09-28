import { IsIn } from 'class-validator';
import { SubscriptionPlan } from '../subscription-state';

/** Which price Stripe Checkout starts with. */
export class CreateCheckoutSessionDto {
  @IsIn(['monthly', 'yearly'])
  plan!: SubscriptionPlan;
}
