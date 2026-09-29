import { HttpException, Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AppointmentsService } from '../appointments/appointments.service';
import { Role } from '../common/types/role';
import { removeFolder } from '../common/utils/storage-folders';
import { SupabaseService } from '../database/supabase.service';
import { PaymentsService } from '../payments/payments.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

/** Where an account's files live, each under a folder named after it. */
const BUCKETS = ['user-photos', 'coiffeur-documents', 'data-exports'];

/**
 * « Supprimer mon compte » (TODO.md Phase 8 — GDPR, and required by Apple).
 * Slots held for a payment are released; a salon is paid what it's owed
 * (or refused if it has nowhere to receive it); the bookings still to come
 * are cancelled and refunded, the other side told; a client's notes and
 * the account's files go; a salon's Stripe customer goes last, so that a
 * failure before leaves its subscription running. Then the account itself,
 * whose past bookings, payments and reviews stay, anonymized (schema.sql:
 * on delete set null). Every step can run again: one that fails stops the
 * deletion, to be tried again — what it already did isn't done twice.
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
    await this.step('holds', () => this.appointments.releaseHoldsOfAccount(userId));
    if (role === 'coiffeur') await this.step('pay', async () => void (await this.payments.settleSalon(userId, now)));
    await this.step('bookings', async () => {
      await this.appointments.cancelUpcomingOf(userId, now);
      await this.appointments.forgetClientNotes(userId);
    });
    await this.step('files', async () => {
      for (const bucket of BUCKETS) await removeFolder(this.supabase.client, bucket, userId);
    });
    if (role === 'coiffeur') await this.step('subscription', () => this.subscriptions.endForDeletion(userId));
    // A hold made meanwhile, at a salon being deleted: released now, or refunded when paid (AppointmentsService.finalizePayment).
    await this.step('holds', () => this.appointments.releaseHoldsOfAccount(userId));

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
