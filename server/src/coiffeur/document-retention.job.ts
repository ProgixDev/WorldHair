import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { removeFolder } from '../common/utils/storage-folders';
import { SupabaseService } from '../database/supabase.service';

/** How long a rejected coiffeur's documents are kept: time to fix the dossier and resubmit (the privacy policy says so). */
export const DOCUMENT_RETENTION_DAYS = 90;

const DAY_MS = 86_400_000;

/**
 * Retention (TODO.md Phase 8): a rejected coiffeur's identity documents,
 * diploma, KBIS and invoice are deleted from storage 90 days after the
 * rejection, and the dossier marked (`documents_purged_at`). Resubmitting
 * means uploading them again. A deleted account's files go at once
 * (AccountDeletionService).
 */
@Injectable()
export class DocumentRetentionJob {
  private readonly logger = new Logger(DocumentRetentionJob.name);

  constructor(private readonly supabase: SupabaseService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run(): Promise<void> {
    try {
      const purged = await this.purgeRejectedDocuments();
      if (purged > 0) this.logger.log(`Documents of ${purged} rejected coiffeur(s) deleted`);
    } catch (err) {
      this.logger.error('Deleting rejected coiffeurs’ documents failed', err as Error);
    }
  }

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
      await removeFolder(this.supabase.client, 'coiffeur-documents', profileId);
      const { error: markError } = await this.supabase.client
        .from('coiffeur_applications')
        .update({ documents_purged_at: now.toISOString() })
        .eq('profile_id', profileId)
        .select('profile_id')
        .maybeSingle();
      if (markError) {
        throw new InternalServerErrorException(markError.message);
      }
      purged += 1;
    }
    return purged;
  }
}
