import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { ReviewsService } from './reviews.service';

const COIFFEUR_ID = 'coiffeur-1';
const PARTICULIER_ID = 'particulier-1';

/** Reporters: the reviewed salon, and another client reading its page. */
const SALON = { id: COIFFEUR_ID, role: 'coiffeur' as const };
const CLIENT = { id: 'another-client', role: 'particulier' as const };

const PAST = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
const FUTURE = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

describe('ReviewsService', () => {
  let supabase: FakeSupabaseService;
  let service: ReviewsService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    service = new ReviewsService(supabase as unknown as SupabaseService);
    supabase.addUser('coiffeur-token', { id: COIFFEUR_ID, email: 'c@example.com', email_confirmed_at: null }, 'coiffeur');
    supabase.addUser(
      'particulier-token',
      { id: PARTICULIER_ID, email: 'p@example.com', email_confirmed_at: null },
      'particulier',
      { firstName: 'Camille', lastName: 'Durand' },
    );
  });

  function seedDoneAppointment(): string {
    return supabase.seedAppointment({
      particulierId: PARTICULIER_ID,
      coiffeurId: COIFFEUR_ID,
      startsAt: PAST,
      status: 'confirmed', // past + confirmed derives to "done"
    });
  }

  describe('create', () => {
    it('creates a visible review with a privacy-trimmed author name', async () => {
      const appointmentId = seedDoneAppointment();
      const review = await service.create(PARTICULIER_ID, { appointmentId, rating: 5, tags: ['Écoute'], comment: 'Top !' });

      expect(review).toMatchObject({
        appointmentId,
        salonId: COIFFEUR_ID,
        authorName: 'Camille D.',
        rating: 5,
        tags: ['Écoute'],
        comment: 'Top !',
        status: 'visible',
      });
    });

    it("403s someone else's appointment", async () => {
      const appointmentId = seedDoneAppointment();
      await expect(service.create('someone-else', { appointmentId, rating: 5 })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("marks a review « vérifié » when the client confirmed the service on the spot (end-of-service code)", async () => {
      const plain = seedDoneAppointment();
      const scanned = supabase.seedAppointment({
        particulierId: 'particulier-2',
        coiffeurId: COIFFEUR_ID,
        startsAt: PAST,
        status: 'confirmed',
        confirmedByClientAt: PAST,
      });
      supabase.addUser('p2-token', { id: 'particulier-2', email: 'p2@example.com', email_confirmed_at: null }, 'particulier', { firstName: 'Awa', lastName: 'Sy' });
      await service.create(PARTICULIER_ID, { appointmentId: plain, rating: 4 });
      await service.create('particulier-2', { appointmentId: scanned, rating: 5 });

      const reviews = await service.listForSalon(COIFFEUR_ID);

      expect(reviews.map((review) => [review.authorName, review.verified]).sort()).toEqual([
        ['Awa S.', true],
        ['Camille D.', false],
      ]);
    });

    it('rejects a review for an appointment that is not done yet', async () => {
      const appointmentId = supabase.seedAppointment({
        particulierId: PARTICULIER_ID,
        coiffeurId: COIFFEUR_ID,
        startsAt: FUTURE,
        status: 'confirmed',
      });
      await expect(service.create(PARTICULIER_ID, { appointmentId, rating: 5 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a review for a pending (never confirmed) appointment', async () => {
      const appointmentId = supabase.seedAppointment({
        particulierId: PARTICULIER_ID,
        coiffeurId: COIFFEUR_ID,
        startsAt: PAST,
        status: 'pending',
      });
      await expect(service.create(PARTICULIER_ID, { appointmentId, rating: 5 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a second review for the same appointment', async () => {
      const appointmentId = seedDoneAppointment();
      await service.create(PARTICULIER_ID, { appointmentId, rating: 5 });
      await expect(service.create(PARTICULIER_ID, { appointmentId, rating: 3 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a review of a salon that left WorldHair since', async () => {
      const appointmentId = seedDoneAppointment();
      await supabase.client.auth.admin.deleteUser(COIFFEUR_ID);

      await expect(service.create(PARTICULIER_ID, { appointmentId, rating: 5 })).rejects.toThrow(/left WorldHair/);
    });

    it('rejects a review for an appointment the salon marked as a no-show', async () => {
      const appointmentId = supabase.seedAppointment({
        particulierId: PARTICULIER_ID,
        coiffeurId: COIFFEUR_ID,
        startsAt: PAST,
        status: 'confirmed',
        attendance: 'no_show',
      });
      await expect(service.create(PARTICULIER_ID, { appointmentId, rating: 1 })).rejects.toThrow(/missed/);
    });
  });

  describe('visibility', () => {
    it('a merely-reported review still shows publicly — only an admin hiding it removes it', async () => {
      const shown = await service.create(PARTICULIER_ID, { appointmentId: seedDoneAppointment(), rating: 5 });
      const reported = await service.create(PARTICULIER_ID, { appointmentId: seedDoneAppointment(), rating: 1 });
      await service.report(reported.id, CLIENT, { reason: 'offensive' });

      const beforeModeration = await service.listForSalon(COIFFEUR_ID);
      expect(beforeModeration.map((r) => r.id).sort()).toEqual([reported.id, shown.id].sort());

      await service.moderate(reported.id, 'hide');
      const afterHide = await service.listForSalon(COIFFEUR_ID);
      expect(afterHide.map((r) => r.id)).toEqual([shown.id]);

      const mine = await service.listMine(PARTICULIER_ID);
      expect(mine.map((r) => r.id).sort()).toEqual([reported.id, shown.id].sort());

      const ownerView = await service.listForCoiffeurOwner(COIFFEUR_ID);
      expect(ownerView.map((r) => r.id).sort()).toEqual([reported.id, shown.id].sort());
    });
  });

  describe('an author deleted since (TODO.md Phase 8)', () => {
    it('keeps the review, as « Ancien client », everywhere it shows', async () => {
      const review = await service.create(PARTICULIER_ID, { appointmentId: seedDoneAppointment(), rating: 4, comment: 'Très bien.' });
      await supabase.client.auth.admin.deleteUser(PARTICULIER_ID);

      expect(supabase.reviewFor(review.id)).toMatchObject({ particulier_id: null, comment: 'Très bien.' });
      await expect(service.listForSalon(COIFFEUR_ID)).resolves.toMatchObject([{ id: review.id, authorName: 'Ancien client' }]);
      await service.report(review.id, SALON, { reason: 'spam' });
      await expect(service.listReported()).resolves.toMatchObject([{ id: review.id, authorName: 'Ancien client', authorFullName: 'Ancien client' }]);
    });
  });

  describe('reply / deleteReply', () => {
    it('lets the coiffeur reply, then clear the reply', async () => {
      const review = await service.create(PARTICULIER_ID, { appointmentId: seedDoneAppointment(), rating: 5 });
      await service.reply(COIFFEUR_ID, review.id, 'Merci beaucoup !');
      let list = await service.listForSalon(COIFFEUR_ID);
      expect(list[0].reply).toBe('Merci beaucoup !');

      await service.deleteReply(COIFFEUR_ID, review.id);
      list = await service.listForSalon(COIFFEUR_ID);
      expect(list[0].reply).toBeUndefined();
    });

    it("403s a different coiffeur replying to someone else's review", async () => {
      const review = await service.create(PARTICULIER_ID, { appointmentId: seedDoneAppointment(), rating: 5 });
      await expect(service.reply('another-coiffeur', review.id, 'Hey')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('report / admin moderation', () => {
    it("lets anyone reading a review report it once, with a reason: it joins the admins' queue and stays visible", async () => {
      const review = await service.create(PARTICULIER_ID, { appointmentId: seedDoneAppointment(), rating: 1 });

      await service.report(review.id, SALON, { reason: 'fake', details: "  Cette cliente n'est jamais venue.  " });
      await service.report(review.id, CLIENT, { reason: 'offensive' });

      expect((await service.listReported()).map((r) => r.id)).toEqual([review.id]);
      expect((await service.listForSalon(COIFFEUR_ID)).map((r) => r.id)).toEqual([review.id]);
      expect(supabase.reportsOf(review.id)).toEqual([
        expect.objectContaining({ reporter_id: COIFFEUR_ID, reason: 'fake', details: "Cette cliente n'est jamais venue." }),
        expect.objectContaining({ reporter_id: 'another-client', reason: 'offensive', details: null }),
      ]);
    });

    it("lets a salon report only its own salon's reviews", async () => {
      const review = await service.create(PARTICULIER_ID, { appointmentId: seedDoneAppointment(), rating: 1 });

      await expect(
        service.report(review.id, { id: 'another-salon', role: 'coiffeur' }, { reason: 'fake' }),
      ).rejects.toThrow(ForbiddenException);
      await expect(service.report(review.id, { id: COIFFEUR_ID, role: 'coiffeur' }, { reason: 'fake' })).resolves.toBeUndefined();
    });

    it("gets the review to the admins even when the first try couldn't flag it", async () => {
      const review = await service.create(PARTICULIER_ID, { appointmentId: seedDoneAppointment(), rating: 1 });
      // Recorded, but the review itself never got flagged (the second write failed).
      supabase.seedReviewReport({ reviewId: review.id, reporterId: 'another-client', reason: 'spam' });

      await expect(service.report(review.id, CLIENT, { reason: 'spam' })).rejects.toThrow(ConflictException);

      expect((await service.listReported()).map((r) => r.id)).toEqual([review.id]);
    });

    it("doesn't put a review the admins cleared back in their queue when its reporter reports it again", async () => {
      const review = await service.create(PARTICULIER_ID, { appointmentId: seedDoneAppointment(), rating: 1 });
      await service.report(review.id, SALON, { reason: 'fake' });
      await service.moderate(review.id, 'restore');

      await expect(service.report(review.id, SALON, { reason: 'fake' })).rejects.toThrow(ConflictException);

      expect(await service.listReported()).toEqual([]);
      // Someone else's report still reaches the admins.
      await service.report(review.id, CLIENT, { reason: 'offensive' });
      expect((await service.listReported()).map((r) => r.id)).toEqual([review.id]);
    });

    it('lists every hidden review, however many authors — ids go to the database a hundred at a time', async () => {
      const hidden: string[] = [];
      for (let i = 0; i < 101; i++) {
        const authorId = `author-${i}`;
        supabase.addUser(`author-token-${i}`, { id: authorId, email: `a${i}@example.com`, email_confirmed_at: null }, 'particulier', {
          firstName: `Auteur${i}`,
          lastName: 'Test',
        });
        const appointmentId = supabase.seedAppointment({ particulierId: authorId, coiffeurId: COIFFEUR_ID, startsAt: PAST, status: 'confirmed' });
        const review = await service.create(authorId, { appointmentId, rating: 1 });
        await service.moderate(review.id, 'hide');
        hidden.push(review.id);
      }

      const list = await service.listHidden();

      expect(list.map((review) => review.id).sort()).toEqual(hidden.sort());
      expect(list.every((review) => review.authorFullName.startsWith('Auteur'))).toBe(true);
    });

    it('refuses a second report from the same person, and an author reporting their own review', async () => {
      const review = await service.create(PARTICULIER_ID, { appointmentId: seedDoneAppointment(), rating: 1 });
      await service.report(review.id, CLIENT, { reason: 'spam' });

      await expect(service.report(review.id, CLIENT, { reason: 'spam' })).rejects.toThrow(ConflictException);
      await expect(service.report(review.id, { id: PARTICULIER_ID, role: 'particulier' }, { reason: 'spam' })).rejects.toThrow(BadRequestException);
    });

    it('tells each reader which reviews they already reported', async () => {
      const first = await service.create(PARTICULIER_ID, { appointmentId: seedDoneAppointment(), rating: 1 });
      const second = await service.create(PARTICULIER_ID, { appointmentId: seedDoneAppointment(), rating: 2 });
      await service.report(first.id, CLIENT, { reason: 'spam' });
      await service.report(second.id, SALON, { reason: 'fake' });

      const forClient = await service.listForSalon(COIFFEUR_ID, 'another-client');
      const forOwner = await service.listForCoiffeurOwner(COIFFEUR_ID);

      expect(forClient.map((r) => [r.id, r.reportedByMe])).toEqual(
        expect.arrayContaining([
          [first.id, true],
          [second.id, false],
        ]),
      );
      expect(forOwner.find((r) => r.id === second.id)?.reportedByMe).toBe(true);
      expect(forOwner.find((r) => r.id === first.id)?.reportedByMe).toBe(false);
    });

    it('keeps a report on a review the admins already hid, which stays hidden', async () => {
      const review = await service.create(PARTICULIER_ID, { appointmentId: seedDoneAppointment(), rating: 1 });
      await service.moderate(review.id, 'hide');

      await service.report(review.id, CLIENT, { reason: 'personal_info' });

      expect(supabase.reportsOf(review.id)).toHaveLength(1);
      expect(await service.listReported()).toEqual([]);
      expect(await service.listForSalon(COIFFEUR_ID)).toEqual([]);
    });

    it('shows the admins the salon, and who reported the review and why — a salon by its name', async () => {
      supabase.seedValidatedSalon({ profileId: COIFFEUR_ID, firstName: 'Sofia', lastName: 'Benali', salonName: 'Studio Élégance' });
      supabase.addUser('reader-token', { id: 'another-client', email: 'a@example.com', email_confirmed_at: null }, 'particulier', {
        firstName: 'Awa',
        lastName: 'Diallo',
      });
      const review = await service.create(PARTICULIER_ID, { appointmentId: seedDoneAppointment(), rating: 1 });
      await service.report(review.id, SALON, { reason: 'fake', details: "Cette cliente n'est jamais venue." });
      await service.report(review.id, CLIENT, { reason: 'offensive' });

      const [reported] = await service.listReported();

      expect(reported).toMatchObject({
        id: review.id,
        salonName: 'Studio Élégance',
        authorFullName: 'Camille Durand',
        reportReason: 'offensive',
        reports: [
          { reporterId: COIFFEUR_ID, reporterName: 'Studio Élégance', reporterRole: 'coiffeur', reason: 'fake', details: "Cette cliente n'est jamais venue." },
          { reporterId: 'another-client', reporterName: 'Awa Diallo', reporterRole: 'particulier', reason: 'offensive', details: null },
        ],
      });
    });

    it('still shows the reason of a review reported before each report was kept', async () => {
      const review = await service.create(PARTICULIER_ID, { appointmentId: seedDoneAppointment(), rating: 1 });
      supabase.seedLegacyReport(review.id, 'Langage inapproprié');

      await expect(service.listReported()).resolves.toMatchObject([{ id: review.id, reports: [], reportReason: 'Langage inapproprié' }]);
    });

    it('lists the hidden reviews too, so the admins can put one back', async () => {
      const hidden = await service.create(PARTICULIER_ID, { appointmentId: seedDoneAppointment(), rating: 1 });
      await service.create(PARTICULIER_ID, { appointmentId: seedDoneAppointment(), rating: 5 });
      await service.report(hidden.id, CLIENT, { reason: 'spam' });
      await service.moderate(hidden.id, 'hide');

      const list = await service.listHidden();
      expect(list).toMatchObject([{ id: hidden.id, status: 'hidden', reports: [{ reason: 'spam' }] }]);

      await service.moderate(hidden.id, 'restore');
      await expect(service.listHidden()).resolves.toEqual([]);
    });

    it('reports a review, then an admin can hide and restore it', async () => {
      const review = await service.create(PARTICULIER_ID, { appointmentId: seedDoneAppointment(), rating: 1 });
      await service.report(review.id, CLIENT, { reason: 'offensive', details: 'Langage inapproprié' });

      const reported = await service.listReported();
      expect(reported.map((r) => r.id)).toEqual([review.id]);

      await service.moderate(review.id, 'hide');
      expect((await service.listForSalon(COIFFEUR_ID))).toHaveLength(0);
      expect((await service.listReported())).toHaveLength(0);

      await service.moderate(review.id, 'restore');
      expect((await service.listForSalon(COIFFEUR_ID)).map((r) => r.id)).toEqual([review.id]);
    });
  });
});
