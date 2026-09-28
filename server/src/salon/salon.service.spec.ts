import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { SupabaseService } from '../database/supabase.service';
import { SalonService } from './salon.service';

const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';

describe('SalonService', () => {
  let supabase: FakeSupabaseService;
  let service: SalonService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    service = new SalonService(supabase as unknown as SupabaseService);
  });

  describe('profile', () => {
    it('getProfile() returns an empty default before anything is saved', async () => {
      await expect(service.getProfile(USER_ID)).resolves.toEqual({
        salonName: '',
        tagline: '',
        description: '',
        addressLine: '',
        postalCode: '',
        city: '',
        phone: '',
        phoneCountry: null,
        specialties: [],
        coverUrl: null,
        latitude: null,
        longitude: null,
        confirmationMode: 'manual',
        bookingNoticeMinutes: 60,
        cancellationNoticeMinutes: 1440,
      });
    });

    it('updateProfile() saves the booking rules: instant confirmation and both deadlines', async () => {
      const updated = await service.updateProfile(USER_ID, {
        confirmationMode: 'instant',
        bookingNoticeMinutes: 120,
        cancellationNoticeMinutes: 0,
      });

      expect(updated).toMatchObject({ confirmationMode: 'instant', bookingNoticeMinutes: 120, cancellationNoticeMinutes: 0 });
      await expect(service.getProfile(USER_ID)).resolves.toMatchObject({ confirmationMode: 'instant' });
    });

    it('updateProfile() keeps the picked phone country alongside the number', async () => {
      const updated = await service.updateProfile(USER_ID, { phone: '+15550001234', phoneCountry: 'CA' });

      expect(updated).toMatchObject({ phone: '+15550001234', phoneCountry: 'CA' });
      await expect(service.getProfile(USER_ID)).resolves.toMatchObject({ phoneCountry: 'CA' });
    });

    it('updateProfile() creates the row on first save and getProfile() then returns it', async () => {
      const updated = await service.updateProfile(USER_ID, {
        salonName: 'Studio W',
        specialties: ['coupe', 'afro'],
      });

      expect(updated).toMatchObject({ salonName: 'Studio W', specialties: ['coupe', 'afro'] });
      await expect(service.getProfile(USER_ID)).resolves.toMatchObject({ salonName: 'Studio W' });
    });

    it('updateProfile() only touches the fields provided', async () => {
      await service.updateProfile(USER_ID, { salonName: 'Studio W', city: 'Paris' });
      const updated = await service.updateProfile(USER_ID, { tagline: 'Coupe & couleur' });

      expect(updated).toMatchObject({ salonName: 'Studio W', city: 'Paris', tagline: 'Coupe & couleur' });
    });

    it('seedProfileFromApplication() fills a fresh profile', async () => {
      await service.seedProfileFromApplication(USER_ID, {
        salonName: 'Studio W',
        description: 'Coupe & couleur',
        phone: '+33612345678',
        addressLine: '12 rue des Lilas',
        postalCode: '75011',
        city: 'Paris',
      });

      await expect(service.getProfile(USER_ID)).resolves.toMatchObject({
        salonName: 'Studio W',
        description: 'Coupe & couleur',
        phone: '+33612345678',
        addressLine: '12 rue des Lilas',
        postalCode: '75011',
        city: 'Paris',
      });
    });

    it('seedProfileFromApplication() never overwrites an existing profile', async () => {
      await service.updateProfile(USER_ID, { salonName: 'Already renamed' });

      await service.seedProfileFromApplication(USER_ID, {
        salonName: 'Studio W',
        description: '',
        phone: '',
        addressLine: null,
        postalCode: null,
        city: null,
      });

      await expect(service.getProfile(USER_ID)).resolves.toMatchObject({ salonName: 'Already renamed' });
    });
  });

  describe('availability', () => {
    it('getAvailability() returns a sensible 7-day default before anything is saved', async () => {
      const days = await service.getAvailability(USER_ID);

      expect(days).toHaveLength(7);
      expect(days.map((d) => d.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(days.find((d) => d.weekday === 0)?.isOpen).toBe(false);
      expect(days.find((d) => d.weekday === 1)?.isOpen).toBe(true);
    });

    it('replaceAvailability() persists all 7 days and getAvailability() reflects them', async () => {
      const monday = {
        weekday: 1,
        isOpen: false,
        opensMinute: 540,
        closesMinute: 1140,
        breakStartMinute: null,
        breakEndMinute: null,
      };
      const week = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ ...monday, weekday }));

      await service.replaceAvailability(USER_ID, week);
      const days = await service.getAvailability(USER_ID);

      expect(days.every((d) => d.isOpen === false)).toBe(true);
    });

    it("scopes availability to the caller — one coiffeur's save doesn't leak into another's read", async () => {
      const closedWeek = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        weekday,
        isOpen: false,
        opensMinute: 540,
        closesMinute: 1140,
        breakStartMinute: null,
        breakEndMinute: null,
      }));
      await service.replaceAvailability(USER_ID, closedWeek);

      const otherDefault = await service.getAvailability(OTHER_USER_ID);
      expect(otherDefault.find((d) => d.weekday === 1)?.isOpen).toBe(true);
    });
  });

  describe('services (prestations)', () => {
    it('listServices() starts empty', async () => {
      await expect(service.listServices(USER_ID)).resolves.toEqual([]);
    });

    it('createService() then listServices() shows it', async () => {
      const created = await service.createService(USER_ID, {
        name: 'Coupe & brushing',
        price: 40,
        durationMin: 45,
        specialty: 'coupe',
      });

      expect(created).toMatchObject({ name: 'Coupe & brushing', price: 40, durationMin: 45 });
      await expect(service.listServices(USER_ID)).resolves.toEqual([created]);
    });

    it('updateService() changes only the given fields', async () => {
      const created = await service.createService(USER_ID, {
        name: 'Coupe',
        price: 30,
        durationMin: 30,
        specialty: 'coupe',
      });

      const updated = await service.updateService(USER_ID, created.id, { price: 35 });
      expect(updated).toMatchObject({ id: created.id, name: 'Coupe', price: 35 });
    });

    it("updateService() 404s on another coiffeur's service", async () => {
      const created = await service.createService(USER_ID, {
        name: 'Coupe',
        price: 30,
        durationMin: 30,
        specialty: 'coupe',
      });

      await expect(
        service.updateService(OTHER_USER_ID, created.id, { price: 99 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('deleteService() removes it', async () => {
      const created = await service.createService(USER_ID, {
        name: 'Coupe',
        price: 30,
        durationMin: 30,
        specialty: 'coupe',
      });

      await service.deleteService(USER_ID, created.id);
      await expect(service.listServices(USER_ID)).resolves.toEqual([]);
    });

    it("deleteService() 404s on another coiffeur's service", async () => {
      const created = await service.createService(USER_ID, {
        name: 'Coupe',
        price: 30,
        durationMin: 30,
        specialty: 'coupe',
      });

      await expect(service.deleteService(OTHER_USER_ID, created.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('gallery', () => {
    it('listGalleryPhotos() starts empty', async () => {
      await expect(service.listGalleryPhotos(USER_ID)).resolves.toEqual([]);
    });

    it('addGalleryPhoto() then listGalleryPhotos() shows it, oldest first', async () => {
      await service.addGalleryPhoto(USER_ID, { url: 'https://x/1.jpg', storagePath: 'u1/gallery/1.jpg' });
      await service.addGalleryPhoto(USER_ID, { url: 'https://x/2.jpg', storagePath: 'u1/gallery/2.jpg' });

      const photos = await service.listGalleryPhotos(USER_ID);
      expect(photos.map((p) => p.url)).toEqual(['https://x/1.jpg', 'https://x/2.jpg']);
    });

    it('addGalleryPhoto() refuses past the cap', async () => {
      for (let i = 0; i < 12; i++) {
        await service.addGalleryPhoto(USER_ID, { url: `https://x/${i}.jpg`, storagePath: `u1/gallery/${i}.jpg` });
      }

      await expect(
        service.addGalleryPhoto(USER_ID, { url: 'https://x/13.jpg', storagePath: 'u1/gallery/13.jpg' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deleteGalleryPhoto() removes it', async () => {
      const [photo] = await service.addGalleryPhoto(USER_ID, {
        url: 'https://x/1.jpg',
        storagePath: 'u1/gallery/1.jpg',
      });

      await service.deleteGalleryPhoto(USER_ID, photo.id);
      await expect(service.listGalleryPhotos(USER_ID)).resolves.toEqual([]);
    });

    it("deleteGalleryPhoto() 404s on another coiffeur's photo", async () => {
      const [photo] = await service.addGalleryPhoto(USER_ID, {
        url: 'https://x/1.jpg',
        storagePath: 'u1/gallery/1.jpg',
      });

      await expect(service.deleteGalleryPhoto(OTHER_USER_ID, photo.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('closures (congés, fermetures exceptionnelles)', () => {
    const inDays = (days: number, hour = 0) => {
      const date = new Date(Date.now() + days * 86_400_000);
      date.setUTCHours(hour, 0, 0, 0);
      return date.toISOString();
    };

    it('addTimeOff() saves a closure and listTimeOff() returns the upcoming ones, soonest first', async () => {
      await service.addTimeOff(USER_ID, { startsAt: inDays(10), endsAt: inDays(12), label: 'Congés' });
      await service.addTimeOff(USER_ID, { startsAt: inDays(3, 12), endsAt: inDays(3, 18) });

      const list = await service.listTimeOff(USER_ID);
      expect(list.map((closure) => closure.label)).toEqual(['', 'Congés']);
      expect(list[1]).toMatchObject({ startsAt: inDays(10), endsAt: inDays(12) });
    });

    it('listTimeOff() leaves out closures that are already over', async () => {
      supabase.seedTimeOff({ profileId: USER_ID, startsAt: inDays(-5), endsAt: inDays(-3) });

      await expect(service.listTimeOff(USER_ID)).resolves.toEqual([]);
    });

    it("addTimeOff() lists the salon's active bookings that fall inside the closure, without cancelling them", async () => {
      const inside = supabase.seedAppointment({
        particulierId: 'p1',
        coiffeurId: USER_ID,
        startsAt: inDays(10, 10),
        status: 'confirmed',
        durationMin: 60,
      });
      supabase.seedAppointment({ particulierId: 'p2', coiffeurId: USER_ID, startsAt: inDays(10, 11), status: 'cancelled' });
      supabase.seedAppointment({ particulierId: 'p3', coiffeurId: USER_ID, startsAt: inDays(20, 10), status: 'confirmed' });
      supabase.seedAppointment({ particulierId: 'p4', coiffeurId: OTHER_USER_ID, startsAt: inDays(10, 10), status: 'confirmed' });

      const { conflicts } = await service.addTimeOff(USER_ID, { startsAt: inDays(10), endsAt: inDays(11) });

      expect(conflicts.map((conflict) => conflict.appointmentId)).toEqual([inside]);
      expect(conflicts[0]).toMatchObject({ durationMin: 60, status: 'confirmed' });
    });

    it("addTimeOff() leaves out the salon's bookings that are already over", async () => {
      const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
      supabase.seedAppointment({ particulierId: 'p1', coiffeurId: USER_ID, startsAt: hoursAgo(3), durationMin: 60, status: 'confirmed' });
      const running = supabase.seedAppointment({
        particulierId: 'p2',
        coiffeurId: USER_ID,
        startsAt: hoursAgo(0.5),
        durationMin: 60,
        status: 'confirmed',
      });

      const { conflicts } = await service.addTimeOff(USER_ID, { startsAt: hoursAgo(5), endsAt: inDays(1) });

      expect(conflicts.map((conflict) => conflict.appointmentId)).toEqual([running]);
    });

    it('addTimeOff() refuses a closure that ends before it starts, or is already over', async () => {
      await expect(service.addTimeOff(USER_ID, { startsAt: inDays(5), endsAt: inDays(4) })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.addTimeOff(USER_ID, { startsAt: inDays(-3), endsAt: inDays(-2) })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("deleteTimeOff() removes the coiffeur's own closure, 404s on someone else's", async () => {
      const { timeOff } = await service.addTimeOff(USER_ID, { startsAt: inDays(3), endsAt: inDays(4) });

      await expect(service.deleteTimeOff(OTHER_USER_ID, timeOff.id)).rejects.toThrow(NotFoundException);
      await service.deleteTimeOff(USER_ID, timeOff.id);
      await expect(service.listTimeOff(USER_ID)).resolves.toEqual([]);
    });
  });
});
