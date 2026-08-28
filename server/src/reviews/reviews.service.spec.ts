import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { ReviewsService } from './reviews.service';

const COIFFEUR_ID = 'coiffeur-1';
const PARTICULIER_ID = 'particulier-1';

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
  });

  describe('visibility', () => {
    it('a merely-reported review still shows publicly — only an admin hiding it removes it', async () => {
      const shown = await service.create(PARTICULIER_ID, { appointmentId: seedDoneAppointment(), rating: 5 });
      const reported = await service.create(PARTICULIER_ID, { appointmentId: seedDoneAppointment(), rating: 1 });
      await service.report(reported.id, 'Contenu abusif');

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
    it('reports a review, then an admin can hide and restore it', async () => {
      const review = await service.create(PARTICULIER_ID, { appointmentId: seedDoneAppointment(), rating: 1 });
      await service.report(review.id, 'Langage inapproprié');

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
