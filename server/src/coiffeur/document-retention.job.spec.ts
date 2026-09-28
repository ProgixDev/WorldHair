import { SupabaseService } from '../database/supabase.service';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { DOCUMENT_RETENTION_DAYS, DocumentRetentionJob } from './document-retention.job';

const DAY_MS = 86_400_000;

describe('DocumentRetentionJob', () => {
  let supabase: FakeSupabaseService;
  let job: DocumentRetentionJob;
  const now = new Date('2026-12-01T03:00:00.000Z');
  const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS).toISOString();

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    job = new DocumentRetentionJob(supabase as unknown as SupabaseService);
  });

  function applicant(profileId: string, status: string, reviewedAt: string | null): void {
    supabase.seedApplication({ profileId, status, reviewedAt });
    for (const kind of ['identity', 'diploma', 'kbis']) supabase.seedStorageObject('coiffeur-documents', `${profileId}/${kind}.pdf`);
  }

  it(`deletes a rejected coiffeur's documents ${DOCUMENT_RETENTION_DAYS} days after the rejection — once`, async () => {
    applicant('rejected-long-ago', 'rejected', daysAgo(DOCUMENT_RETENTION_DAYS + 1));
    applicant('rejected-lately', 'rejected', daysAgo(DOCUMENT_RETENTION_DAYS - 1));
    applicant('validated-long-ago', 'validated', daysAgo(400));
    applicant('pending', 'pending', null);

    await expect(job.purgeRejectedDocuments(now)).resolves.toBe(1);

    const left = supabase.storagePaths('coiffeur-documents');
    expect(left.filter((path) => path.startsWith('rejected-long-ago/'))).toEqual([]);
    expect(left).toHaveLength(9);
    expect(supabase.applicationFor('rejected-long-ago')?.documents_purged_at).toBe(now.toISOString());
    expect(supabase.applicationFor('rejected-lately')?.documents_purged_at ?? null).toBeNull();

    await expect(job.purgeRejectedDocuments(now)).resolves.toBe(0);
  });
});
