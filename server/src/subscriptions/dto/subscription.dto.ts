import { IsIn, IsOptional } from 'class-validator';
import { SubscriptionPlan } from '../subscription-state';
import { SubscriptionTier } from '../tiers';

/** Which price Stripe Checkout starts with: a tier's monthly or yearly one. */
export class CreateCheckoutSessionDto {
  /** Absent: Solo, what a website from before tiers asks for. */
  @IsOptional()
  @IsIn(['solo', 'team'])
  tier?: SubscriptionTier;

  @IsIn(['monthly', 'yearly'])
  plan!: SubscriptionPlan;
}
