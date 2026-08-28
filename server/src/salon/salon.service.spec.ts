import { NotFoundException } from '@nestjs/common';
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
        specialties: [],
        coverUrl: null,
        latitude: null,
        longitude: null,
      });
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
});
