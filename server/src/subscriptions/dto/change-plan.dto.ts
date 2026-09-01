import { IsIn } from 'class-validator';
import { SubscriptionPlan } from '../subscriptions.service';

export class ChangePlanDto {
  @IsIn(['monthly', 'yearly'])
  plan!: SubscriptionPlan;
}
