import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { allPages } from '../common/utils/pages';
import { slices } from '../common/utils/slices';
import { removeFolder } from '../common/utils/storage-folders';
import { SupabaseService } from '../database/supabase.service';

/** How long a rejected coiffeur's documents are kept: time to fix the dossier and resubmit (the privacy policy says so). */
export const DOCUMENT_RETENTION_DAYS = 90;

/** The accounting duty: bookings and payments kept, anonymized, after an account's deletion (Code de commerce, L123-22). */
export const RECORDS_RETENTION_YEARS = 10;

/** Where large data exports wait for their download (see DataExportService). */
const EXPORTS_BUCKET = 'data-exports';

const DAY_MS = 86_400_000;
/** Pages of 100 exporters a night at most: well past a day's exports. */
const MAX_EXPORT_ROUNDS = 100;

/**
 * Retention (TODO.md Phase 8), each night:
 * - a rejected coiffeur's identity documents, diploma, KBIS and invoice go
 *   90 days after the rejection, and the dossier is marked
 *   (`documents_purged_at`) — resubmitting means uploading them again;
 * - bookings (with their payments and reviews) kept without their client or
 *   salon since an account's deletion go once the ten years are over;
 * - data exports, downloadable for minutes only, go.
 * A deleted account's files go at once (AccountDeletionService).
 */
@Injectable()
export class DocumentRetentionJob {
  private readonly logger = new Logger(DocumentRetentionJob.name);

  constructor(private readonly supabase: SupabaseService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run(): Promise<void> {
    const tasks: [string, () => Promise<number>][] = [
      ['rejected coiffeurs’ documents', () => this.purgeRejectedDocuments()],
      ['anonymized bookings past ten years', () => this.purgeAnonymizedRecords()],
      ['data exports', () => this.purgeDataExports()],
    ];
    for (const [name, task] of tasks) {
      try {
        const purged = await task();
        if (purged > 0) this.logger.log(`Retention: ${purged} ${name} deleted`);
      } catch (err) {
        this.logger.error(`Retention: deleting ${name} failed`, err as Error);
      }
    }
  }

  /** Answers how many dossiers had their documents deleted; one storage can't reach now is tried again the next night. */
  async purgeRejectedDocuments(now = new Date()): Promise<number> {
    const { data, error } = await this.supabase.client
      .from('coiffeur_applications')
      .select('profile_id')
      .eq('status', 'rejected')
      .is('documents_purged_at', null)
      .lte('reviewed_at', new Date(now.getTime() - DOCUMENT_RETENTION_DAYS * DAY_MS).toISOString());
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    let purged = 0;
    for (const { profile_id: profileId } of data as { profile_id: string }[]) {
      try {
        await removeFolder(this.supabase.client, 'coiffeur-documents', profileId);
        const { error: markError } = await this.supabase.client
          .from('coiffeur_applications')
          .update({ documents_purged_at: now.toISOString() })
          .eq('profile_id', profileId)
          .select('profile_id')
          .maybeSingle();
        if (markError) throw new Error(markError.message);
        purged += 1;
      } catch (err) {
        this.logger.warn(`Couldn't delete the documents of rejected coiffeur ${profileId}`, err as Error);
      }
    }
    return purged;
  }

  /** Bookings without their client or salon (an account deleted), started over ten years ago — their payments and reviews go with them. */
  async purgeAnonymizedRecords(now = new Date()): Promise<number> {
    const cutoff = new Date(now);
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - RECORDS_RETENTION_YEARS);
    const ids = new Set<string>();
    for (const side of ['particulier_id', 'coiffeur_id']) {
      const rows = await allPages<{ id: string }>((from, to) =>
        this.supabase.client
          .from('appointments')
          .select('id')
          .is(side, null)
          .lt('starts_at', cutoff.toISOString())
          .order('starts_at')
          .order('id')
          .range(from, to),
      );
      for (const row of rows) ids.add(row.id);
    }
    for (const slice of slices([...ids])) {
      const { error } = await this.supabase.client.from('appointments').delete().in('id', slice);
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
    }
    return ids.size;
  }

  /** Every data export: each was downloadable for ten minutes. */
  async purgeDataExports(): Promise<number> {
    let purged = 0;
    // The root lists one folder per account that exported; each emptied goes from the list, so the first page is read again.
    for (let round = 0; round < MAX_EXPORT_ROUNDS; round++) {
      const { data, error } = await this.supabase.client.storage.from(EXPORTS_BUCKET).list('', { limit: 100 });
      if (error) {
        throw new Error(error.message);
      }
      const folders = data.filter((entry) => !entry.id);
      if (folders.length === 0) break;
      for (const folder of folders) purged += await removeFolder(this.supabase.client, EXPORTS_BUCKET, folder.name);
    }
    return purged;
  }
}
