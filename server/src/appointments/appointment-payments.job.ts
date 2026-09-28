import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppointmentsService } from './appointments.service';

/**
 * The booking side of payments (TODO.md Phase 5): slots held for a payment
 * nobody finished go back to everyone, and requests the salon never answered
 * before their time are cancelled and refunded.
 */
@Injectable()
export class AppointmentPaymentsJob {
  private readonly logger = new Logger(AppointmentPaymentsJob.name);

  constructor(private readonly appointments: AppointmentsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async releaseStaleHolds(): Promise<void> {
    try {
      await this.appointments.releaseStaleHolds();
    } catch (err) {
      this.logger.error('Releasing unpaid holds failed', err as Error);
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireUnansweredRequests(): Promise<void> {
    try {
      await this.appointments.expireUnansweredRequests();
    } catch (err) {
      this.logger.error('Expiring unanswered requests failed', err as Error);
    }
  }
}
