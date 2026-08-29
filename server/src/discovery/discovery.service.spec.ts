import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CoiffeurApplicationsService } from '../coiffeur/coiffeur-applications.service';
import { SupabaseService } from '../database/supabase.service';
import { SalonService } from '../salon/salon.service';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { DiscoveryService } from './discovery.service';

const PARIS = { lat: 48.8606, lng: 2.3376 };
const LYON = { lat: 45.764, lng: 4.8357 };

describe('DiscoveryService', () => {
  let supabase: FakeSupabaseService;
  let discovery: DiscoveryService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    const applications = new CoiffeurApplicationsService(supabase as unknown as SupabaseService, new EventEmitter2());
    const salon = new SalonService(supabase as unknown as SupabaseService);
    discovery = new DiscoveryService(supabase as unknown as SupabaseService, applications, salon);
  });

  describe('search', () => {
    it('only returns validated, shop-complete coiffeurs', async () => {
      supabase.seedValidatedSalon({
        profileId: 'p1',
        firstName: 'Sofia',
        lastName: 'Benali',
        salonName: 'Studio W',
        city: 'Paris',
        latitude: PARIS.lat,
        longitude: PARIS.lng,
      });
      // Has a filled-in shop profile, but the application review moved back
      // to pending (e.g. a re-review) — still shouldn't be publicly visible.
      supabase.seedValidatedSalon({ profileId: 'p2', firstName: 'A', lastName: 'B', salonName: 'Not Yet' });
      supabase.seedApplication({ profileId: 'p2', status: 'pending' });

      const result = await discovery.search({ limit: 20, offset: 0 });
      expect(result.items.map((item) => item.id)).toEqual(['p1']);
      expect(result.total).toBe(1);
    });

    it('filters by specialty and city', async () => {
      supabase.seedValidatedSalon({
        profileId: 'p1',
        firstName: 'Sofia',
        lastName: 'Benali',
        salonName: 'Studio W',
        city: 'Paris',
        specialties: ['coupe', 'coloration'],
      });
      supabase.seedValidatedSalon({
        profileId: 'p2',
        firstName: 'Awa',
        lastName: 'Diallo',
        salonName: 'Maison Tresse',
        city: 'Lyon',
        specialties: ['afro', 'tresses'],
      });

      const bySpecialty = await discovery.search({ specialty: 'tresses', limit: 20, offset: 0 });
      expect(bySpecialty.items.map((item) => item.id)).toEqual(['p2']);

      const byCity = await discovery.search({ city: 'paris', limit: 20, offset: 0 });
      expect(byCity.items.map((item) => item.id)).toEqual(['p1']);
    });

    it('matches free text against the salon name', async () => {
      supabase.seedValidatedSalon({ profileId: 'p1', firstName: 'A', lastName: 'B', salonName: 'Studio W' });
      supabase.seedValidatedSalon({ profileId: 'p2', firstName: 'C', lastName: 'D', salonName: 'Maison Tresse' });

      const result = await discovery.search({ query: 'tresse', limit: 20, offset: 0 });
      expect(result.items.map((item) => item.id)).toEqual(['p2']);
    });

    it('computes distance and orders by proximity within a radius', async () => {
      supabase.seedValidatedSalon({
        profileId: 'paris-salon',
        firstName: 'A',
        lastName: 'B',
        salonName: 'Studio Paris',
        latitude: PARIS.lat,
        longitude: PARIS.lng,
      });
      supabase.seedValidatedSalon({
        profileId: 'lyon-salon',
        firstName: 'C',
        lastName: 'D',
        salonName: 'Studio Lyon',
        latitude: LYON.lat,
        longitude: LYON.lng,
      });
      // Hasn't set a location yet (e.g. a real coiffeur who signed up but
      // never filled in coordinates) — must never surface in a radius
      // search just because "unknown" isn't the same as "out of range".
      supabase.seedValidatedSalon({ profileId: 'no-location-salon', firstName: 'E', lastName: 'F', salonName: 'Studio ?' });

      const nearParis = await discovery.search({
        lat: PARIS.lat,
        lng: PARIS.lng,
        radiusKm: 50,
        limit: 20,
        offset: 0,
      });
      expect(nearParis.items.map((item) => item.id)).toEqual(['paris-salon']);
      expect(nearParis.items[0].distanceKm).toBeLessThan(1);

      // No radius this time: distance is still computed and used to sort,
      // but nothing gets filtered out — the unlocated salon just sorts last.
      const everyone = await discovery.search({ lat: PARIS.lat, lng: PARIS.lng, limit: 20, offset: 0 });
      expect(everyone.items.map((item) => item.id)).toEqual(['paris-salon', 'lyon-salon', 'no-location-salon']);
      expect(everyone.items[2].distanceKm).toBeNull();
    });

    it('paginates with limit/offset and reports the total', async () => {
      for (let i = 0; i < 3; i++) {
        supabase.seedValidatedSalon({
          profileId: `p${i}`,
          firstName: 'A',
          lastName: 'B',
          salonName: `Salon ${i}`,
          rating: i,
        });
      }

      const page = await discovery.search({ limit: 2, offset: 1 });
      expect(page.items).toHaveLength(2);
      expect(page.total).toBe(3);
    });

    it('reports priceFrom as the cheapest service', async () => {
      supabase.seedValidatedSalon({
        profileId: 'p1',
        firstName: 'A',
        lastName: 'B',
        salonName: 'Studio W',
        services: [
          { name: 'Coupe', price: 40, durationMin: 30, specialty: 'coupe' },
          { name: 'Couleur', price: 90, durationMin: 90, specialty: 'coloration' },
        ],
      });

      const result = await discovery.search({ limit: 20, offset: 0 });
      expect(result.items[0].priceFrom).toBe(40);
    });
  });

  describe('listCities', () => {
    it('returns distinct, sorted cities among visible salons', async () => {
      supabase.seedValidatedSalon({ profileId: 'p1', firstName: 'A', lastName: 'B', salonName: 'S1', city: 'Lyon' });
      supabase.seedValidatedSalon({ profileId: 'p2', firstName: 'C', lastName: 'D', salonName: 'S2', city: 'Paris' });
      supabase.seedValidatedSalon({ profileId: 'p3', firstName: 'E', lastName: 'F', salonName: 'S3', city: 'Lyon' });

      await expect(discovery.listCities()).resolves.toEqual(['Lyon', 'Paris']);
    });
  });

  describe('getById', () => {
    it('returns the full detail — profile, services and availability', async () => {
      supabase.seedValidatedSalon({
        profileId: 'p1',
        firstName: 'Sofia',
        lastName: 'Benali',
        salonName: 'Studio W',
        services: [{ name: 'Coupe', price: 40, durationMin: 30, specialty: 'coupe' }],
      });

      const detail = await discovery.getById('p1');
      expect(detail).toMatchObject({ id: 'p1', salonName: 'Studio W', stylist: 'Sofia Benali' });
      expect(detail.services).toHaveLength(1);
      expect(detail.availability).toHaveLength(7);
    });

    it("404s a coiffeur who hasn't been validated yet", async () => {
      supabase.seedApplication({ profileId: 'pending-1', firstName: 'A', lastName: 'B', status: 'pending' });

      await expect(discovery.getById('pending-1')).rejects.toThrow(NotFoundException);
    });

    it('404s an unknown id', async () => {
      await expect(discovery.getById('does-not-exist')).rejects.toThrow(NotFoundException);
    });
  });
});
