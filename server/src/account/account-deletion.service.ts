import { HttpException, Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AppointmentsService } from '../appointments/appointments.service';
import { Role } from '../common/types/role';
import { removeFolder } from '../common/utils/storage-folders';
import { SupabaseService } from '../database/supabase.service';
import { PaymentsService } from '../payments/payments.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

/** Where an account's files live, each under a folder named after it. */
const BUCKETS = ['user-photos', 'coiffeur-documents'];

/**
 * « Supprimer mon compte » (TODO.md Phase 8 — GDPR, and required by Apple).
 * The money first, as the only steps that must succeed before anything is
 * gone: a salon is paid what it's owed and its subscription ends. Then every
 * booking still to come is cancelled and refunded, the other side told;
 * the files go; and the account itself, whose past bookings, payments and
 * reviews stay, anonymized (schema.sql: on delete set null). Every step
 * can run again: one that fails stops the deletion, to be tried again.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly appointments: AppointmentsService,
    private readonly payments: PaymentsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async delete(userId: string, role: Role, now = new Date()): Promise<void> {
    await this.step('money', async () => {
      if (role !== 'coiffeur') return;
      await this.payments.settleSalon(userId, now);
      await this.subscriptions.endForDeletion(userId);
    });
    await this.step('bookings', () => this.appointments.closeBookingsOf(userId, now));
    await this.step('files', async () => {
      for (const bucket of BUCKETS) await removeFolder(this.supabase.client, bucket, userId);
    });

    const { error } = await this.supabase.client.auth.admin.deleteUser(userId);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    this.logger.log(`Account ${userId} (${role}) deleted`);
  }

  /** A step Stripe or Storage couldn't finish: the account stays, to be deleted on another try. */
  private async step(name: string, run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`Account deletion stopped at "${name}"`, err as Error);
      throw new ServiceUnavailableException('Your account could not be deleted right now: try again in a few minutes');
    }
  }
}
