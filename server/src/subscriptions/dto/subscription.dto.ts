import {
  AdminSubscriptionSummary,
  DisplaySubscriptionStatus,
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../subscriptions.service';

/** The coiffeur's own view (mobile/src/features/pro/types.ts's `Subscription`). */
export class SubscriptionDto {
  profileId!: string;
  plan!: SubscriptionPlan;
  status!: SubscriptionStatus;
  trialEndsAt!: string | null;
  renewsAt!: string;
}

export function toSubscriptionDto(subscription: Subscription): SubscriptionDto {
  return { ...subscription };
}

/** One row per coiffeur in the admin's `/admin/abonnements` list. */
export class AdminSubscriptionSummaryDto {
  profileId!: string;
  firstName!: string;
  lastName!: string;
  email!: string;
  plan!: SubscriptionPlan;
  status!: DisplaySubscriptionStatus;
  trialEndsAt!: string | null;
  renewsAt!: string | null;
}

export function toAdminSubscriptionSummaryDto(
  summary: AdminSubscriptionSummary,
): AdminSubscriptionSummaryDto {
  return { ...summary };
}
