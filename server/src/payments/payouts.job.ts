import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentsService } from './payments.service';

/** Hourly: pays each salon its share a day after the appointment (PaymentsService.transferDue). */
@Injectable()
export class PayoutsJob {
  private readonly logger = new Logger(PayoutsJob.name);

  constructor(private readonly payments: PaymentsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    try {
      const count = await this.payments.transferDue();
      if (count > 0) this.logger.log(`${count} salon payout(s) sent`);
    } catch (err) {
      this.logger.error('Salon payouts failed', err as Error);
    }
  }
}
