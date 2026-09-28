import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NextSlotService } from '../appointments/next-slot.service';
import { CoiffeurApplicationsService } from '../coiffeur/coiffeur-applications.service';
import { parisTime } from '../common/utils/paris-time';
import { EnvironmentVariables } from '../config/env.validation';
import { SupabaseService } from '../database/supabase.service';
import { PayoutAccountsService } from '../payments/payout-accounts.service';
import { StripeService } from '../stripe/stripe.service';
import { SalonService } from '../salon/salon.service';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { DiscoveryService, SalonSearchResult } from './discovery.service';

const PARIS = { lat: 48.8606, lng: 2.3376 };
const LYON = { lat: 45.764, lng: 4.8357 };

describe('DiscoveryService', () => {
  let supabase: FakeSupabaseService;
  let salon: SalonService;
  let discovery: DiscoveryService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    const applications = new CoiffeurApplicationsService(supabase as unknown as SupabaseService, new EventEmitter2());
    salon = new SalonService(supabase as unknown as SupabaseService);
    const config = { get: () => '' } as unknown as ConfigService<EnvironmentVariables, true>;
    const payouts = new PayoutAccountsService(supabase as unknown as SupabaseService, new StripeService(null, config), config);
    discovery = new DiscoveryService(
      supabase as unknown as SupabaseService,
      applications,
      salon,
      payouts,
      new NextSlotService(supabase as unknown as SupabaseService, salon),
    );
  });

  /** A listed, bookable salon in Paris with one 30-minute prestation at 30 €, unless told otherwise. */
  function seed(profileId: string, overrides: Partial<Parameters<FakeSupabaseService['seedValidatedSalon']>[0]> = {}) {
    supabase.seedValidatedSalon({
      profileId,
      firstName: 'Sofia',
      lastName: 'Benali',
      salonName: profileId,
      latitude: PARIS.lat,
      longitude: PARIS.lng,
      services: [{ name: 'Coupe', price: 30, durationMin: 30, specialty: 'coupe' }],
      ...overrides,
    });
  }

  const names = (result: SalonSearchResult) => result.items.map((item) => item.salonName);
  const page = { limit: 20, offset: 0 };
  // A Wednesday, 10:15 in Paris: inside the default hours (Mon-Sat 9-19, lunch 13-14).
  const WEDNESDAY_1015 = parisTime(2026, 9, 30, 10, 15);
  const openWeek = (closesMinute: number, closedWeekday?: number) =>
    [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      isOpen: weekday !== closedWeekday,
      opensMinute: 540,
      closesMinute,
      breakStartMinute: null,
      breakEndMinute: null,
    }));

  describe('search filters and sorts (TODO.md Phase 6)', () => {
    it('keeps salons offering any of several specialties', async () => {
      seed('a', { specialties: ['afro'] });
      seed('b', { specialties: ['barbier'] });
      seed('c', { specialties: ['coloration'] });

      expect(names(await discovery.search({ specialties: ['afro', 'barbier'], ...page }))).toEqual(['a', 'b']);
    });

    it('matches every word typed, accents aside, across the salon, its coiffeur, its city and its prestations', async () => {
      seed('elegance', {
        salonName: 'Studio Élégance',
        firstName: 'Hélène',
        city: 'Lyon',
        services: [{ name: 'Balayage', price: 80, durationMin: 120, specialty: 'coloration' }],
      });
      seed('nord', { salonName: 'Studio Nord', city: 'Paris' });

      expect(names(await discovery.search({ query: 'elegance LYON', ...page }))).toEqual(['Studio Élégance']);
      expect(names(await discovery.search({ query: 'helene balayage', ...page }))).toEqual(['Studio Élégance']);
      expect(names(await discovery.search({ query: 'studio', ...page }))).toHaveLength(2);
      expect(names(await discovery.search({ query: 'studio marseille', ...page }))).toEqual([]);
    });

    it('keeps salons with a visible prestation within the price range', async () => {
      seed('cheap', { services: [{ name: 'Coupe', price: 20, durationMin: 30, specialty: 'coupe' }] });
      seed('mid', {
        services: [
          { name: 'Coupe', price: 45, durationMin: 30, specialty: 'coupe' },
          { name: 'Couleur', price: 90, durationMin: 90, specialty: 'coloration' },
        ],
      });
      seed('hidden', {
        services: [
          { name: 'Coupe', price: 40, durationMin: 30, specialty: 'coupe', isActive: false },
          { name: 'Couleur', price: 120, durationMin: 90, specialty: 'coloration' },
        ],
      });

      expect(names(await discovery.search({ priceMin: 30, priceMax: 50, ...page }))).toEqual(['mid']);
      expect(names(await discovery.search({ priceMax: 25, ...page }))).toEqual(['cheap']);
    });

    it('open now: within its hours, outside its lunch break and its closures', async () => {
      seed('open');
      seed('closed-on-wednesdays');
      await salon.replaceAvailability('closed-on-wednesdays', openWeek(1140, 3));
      seed('on-leave');
      supabase.seedTimeOff({
        profileId: 'on-leave',
        startsAt: new Date(WEDNESDAY_1015.getTime() - 3_600_000).toISOString(),
        endsAt: new Date(WEDNESDAY_1015.getTime() + 3_600_000).toISOString(),
      });

      expect(names(await discovery.search({ openNow: true, now: WEDNESDAY_1015, ...page }))).toEqual(['open']);
      expect(names(await discovery.search({ openNow: true, now: parisTime(2026, 9, 30, 13, 30), ...page }))).toEqual([]);
    });

    it('open on a given day, and still open after a given time', async () => {
      seed('early');
      seed('late');
      await salon.replaceAvailability('late', openWeek(21 * 60));
      seed('off-on-saturdays');
      await salon.replaceAvailability('off-on-saturdays', openWeek(1140, 6));
      const saturday = '2026-10-03';

      expect(names(await discovery.search({ openOn: saturday, now: WEDNESDAY_1015, ...page }))).toEqual(['early', 'late']);
      expect(names(await discovery.search({ openOn: saturday, openAfter: 19 * 60 + 30, now: WEDNESDAY_1015, ...page }))).toEqual(['late']);
      expect(names(await discovery.search({ openAfter: 20 * 60, now: WEDNESDAY_1015, ...page }))).toEqual(['late']);

      supabase.seedTimeOff({
        profileId: 'early',
        startsAt: parisTime(2026, 10, 3, 0, 0).toISOString(),
        endsAt: parisTime(2026, 10, 4, 0, 0).toISOString(),
      });
      expect(names(await discovery.search({ openOn: saturday, now: WEDNESDAY_1015, ...page }))).toEqual(['late']);
    });

    it('at home: coiffeurs who travel, shown only to clients within their radius', async () => {
      seed('salon');
      seed('near', { practiceZone: 'domicile', travelRadiusKm: 10 });
      seed('far', { practiceZone: 'domicile', travelRadiusKm: 10, latitude: LYON.lat, longitude: LYON.lng });
      const fromParis = { lat: PARIS.lat, lng: PARIS.lng, ...page };

      expect(names(await discovery.search({ practiceZone: 'domicile', ...fromParis }))).toEqual(['near']);
      expect(names(await discovery.search(fromParis))).toEqual(['near', 'salon']);
      expect(names(await discovery.search({ practiceZone: 'salon', ...page }))).toEqual(['salon']);
      expect((await discovery.search({ practiceZone: 'domicile', ...fromParis })).items[0]).toMatchObject({
        practiceZone: 'domicile',
        travelRadiusKm: 10,
      });
    });

    it('keeps the salons inside the area the map shows', async () => {
      seed('paris');
      seed('lyon', { latitude: LYON.lat, longitude: LYON.lng });
      seed('nowhere', { latitude: null, longitude: null });

      expect(names(await discovery.search({ bounds: [48, 2, 49.5, 3], ...page }))).toEqual(['paris']);
    });

    it('keeps only the given salons: the favorites', async () => {
      seed('a');
      seed('b');

      expect(names(await discovery.search({ ids: ['b'], ...page }))).toEqual(['b']);
    });

    it('sorts by rating then number of reviews, or by starting price', async () => {
      seed('a', { rating: 4.2, reviewCount: 10, services: [{ name: 'Coupe', price: 50, durationMin: 30, specialty: 'coupe' }] });
      seed('b', { rating: 4.8, reviewCount: 3, services: [{ name: 'Coupe', price: 30, durationMin: 30, specialty: 'coupe' }] });
      seed('c', { rating: 4.8, reviewCount: 20, services: [{ name: 'Coupe', price: 40, durationMin: 30, specialty: 'coupe' }] });

      expect(names(await discovery.search({ sort: 'rating', ...page }))).toEqual(['c', 'b', 'a']);
      expect(names(await discovery.search({ sort: 'price', ...page }))).toEqual(['b', 'c', 'a']);
    });

    it('pages through equals in a stable order: no salon twice, none skipped', async () => {
      for (const id of ['e', 'c', 'a', 'd', 'b']) seed(id);

      const pages = [0, 2, 4].map((offset) => discovery.search({ limit: 2, offset }));
      const seen = (await Promise.all(pages)).flatMap(names);

      expect(seen).toEqual(['a', 'b', 'c', 'd', 'e']);
    });
  });

  describe('next free slot', () => {
    it("says when each salon can next take its shortest visible prestation, and sorts by the soonest", async () => {
      seed('free', { bookingNoticeMinutes: 60 });
      seed('busy', { bookingNoticeMinutes: 60 });
      // Every Wednesday slot left is taken: its next free time is Thursday's opening.
      supabase.seedAppointment({
        particulierId: 'someone',
        coiffeurId: 'busy',
        startsAt: parisTime(2026, 9, 30, 11, 0).toISOString(),
        durationMin: 480,
        status: 'confirmed',
      });
      seed('offline', { onlineBooking: false });

      const result = await discovery.search({ sort: 'availability', now: WEDNESDAY_1015, ...page });

      expect(result.items.map((item) => [item.salonName, item.nextSlot])).toEqual([
        ['free', parisTime(2026, 9, 30, 11, 30).toISOString()],
        ['busy', parisTime(2026, 10, 1, 9, 0).toISOString()],
        ['offline', null],
      ]);
      expect(result.items.map((item) => item.onlineBooking)).toEqual([true, true, false]);
    });

    it('shows it on the salon page too', async () => {
      seed('free', { bookingNoticeMinutes: 0 });

      await expect(discovery.getById('free', WEDNESDAY_1015)).resolves.toMatchObject({
        nextSlot: parisTime(2026, 9, 30, 10, 30).toISOString(),
      });
    });
  });

  describe('hidden services', () => {
    it('leaves a hidden service off the public page, its starting price and the search price', async () => {
      supabase.seedValidatedSalon({
        profileId: 'p1',
        firstName: 'Sofia',
        lastName: 'Benali',
        salonName: 'Studio W',
        services: [
          { name: 'Coupe', price: 20, durationMin: 30, specialty: 'coupe' },
          { name: 'Couleur', price: 60, durationMin: 90, specialty: 'coloration' },
        ],
      });
      const [cut] = await salon.listServices('p1');
      await salon.updateService('p1', cut.id, { isActive: false });

      const detail = await discovery.getById('p1');
      const { items } = await discovery.search({ limit: 20, offset: 0 });

      expect(detail.services.map((service) => service.name)).toEqual(['Couleur']);
      expect(detail.priceFrom).toBe(60);
      expect(items[0].priceFrom).toBe(60);
    });
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

    it('hides salons whose account is suspended or banned', async () => {
      supabase.seedValidatedSalon({ profileId: 'p1', firstName: 'A', lastName: 'B', salonName: 'Open' });
      supabase.seedValidatedSalon({ profileId: 'p2', firstName: 'C', lastName: 'D', salonName: 'Suspended' });
      supabase.seedValidatedSalon({ profileId: 'p3', firstName: 'E', lastName: 'F', salonName: 'Banned' });
      supabase.setAccountStatus('p2', 'suspended');
      supabase.setAccountStatus('p3', 'banned');

      const result = await discovery.search({ limit: 20, offset: 0 });
      expect(result.items.map((item) => item.id)).toEqual(['p1']);
      expect(result.total).toBe(1);
    });

    it('hides salons without a live subscription', async () => {
      supabase.seedValidatedSalon({ profileId: 'p1', firstName: 'A', lastName: 'B', salonName: 'Subscribed' });
      supabase.seedValidatedSalon({ profileId: 'p2', firstName: 'C', lastName: 'D', salonName: 'Never subscribed', subscribed: false });
      supabase.seedValidatedSalon({ profileId: 'p3', firstName: 'E', lastName: 'F', salonName: 'Unpaid' });
      supabase.seedSubscription({ profileId: 'p3', status: 'unpaid', stripeSubscriptionId: 'sub_3' });

      const result = await discovery.search({ limit: 20, offset: 0 });
      expect(result.items.map((item) => item.id)).toEqual(['p1']);
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

      const bySpecialty = await discovery.search({ specialties: ['tresses'], limit: 20, offset: 0 });
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
      expect(detail.gallery).toEqual([]);
    });

    it("includes the coiffeur's own gallery photos, as plain urls", async () => {
      supabase.seedValidatedSalon({ profileId: 'p1', firstName: 'Sofia', lastName: 'Benali', salonName: 'Studio W' });
      await salon.addGalleryPhoto('p1', { url: 'https://x/1.jpg', storagePath: 'p1/gallery/1.jpg' });

      const detail = await discovery.getById('p1');
      expect(detail.gallery).toEqual(['https://x/1.jpg']);
    });

    it("404s a coiffeur who hasn't been validated yet", async () => {
      supabase.seedApplication({ profileId: 'pending-1', firstName: 'A', lastName: 'B', status: 'pending' });

      await expect(discovery.getById('pending-1')).rejects.toThrow(NotFoundException);
    });

    it('404s an unknown id', async () => {
      await expect(discovery.getById('does-not-exist')).rejects.toThrow(NotFoundException);
    });

    it('404s a salon whose account is suspended or banned', async () => {
      supabase.seedValidatedSalon({ profileId: 'p1', firstName: 'A', lastName: 'B', salonName: 'Banned' });
      supabase.setAccountStatus('p1', 'banned');

      await expect(discovery.getById('p1')).rejects.toThrow(NotFoundException);
    });

    it('says whether the salon takes bookings in the app yet (its Stripe payouts)', async () => {
      supabase.seedValidatedSalon({ profileId: 'p1', firstName: 'A', lastName: 'B', salonName: 'Ready' });
      supabase.seedValidatedSalon({ profileId: 'p2', firstName: 'C', lastName: 'D', salonName: 'Not yet', onlineBooking: false });

      await expect(discovery.getById('p1')).resolves.toMatchObject({ onlineBooking: true });
      await expect(discovery.getById('p2')).resolves.toMatchObject({ onlineBooking: false });
    });

    it('404s a salon without a live subscription', async () => {
      supabase.seedValidatedSalon({ profileId: 'p1', firstName: 'A', lastName: 'B', salonName: 'Lapsed', subscribed: false });

      await expect(discovery.getById('p1')).rejects.toThrow(NotFoundException);
    });

    it("shares the salon's booking rules and upcoming closures, without the closures' private labels", async () => {
      supabase.seedValidatedSalon({
        profileId: 'p1',
        firstName: 'A',
        lastName: 'B',
        salonName: 'Studio W',
        confirmationMode: 'instant',
        bookingNoticeMinutes: 120,
        cancellationNoticeMinutes: 2880,
      });
      const soon = new Date(Date.now() + 5 * 86_400_000).toISOString();
      const later = new Date(Date.now() + 6 * 86_400_000).toISOString();
      supabase.seedTimeOff({ profileId: 'p1', startsAt: soon, endsAt: later, label: 'Mariage de ma sœur' });
      supabase.seedTimeOff({
        profileId: 'p1',
        startsAt: new Date(Date.now() - 6 * 86_400_000).toISOString(),
        endsAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
      });

      const detail = await discovery.getById('p1');

      expect(detail).toMatchObject({
        confirmationMode: 'instant',
        bookingNoticeMinutes: 120,
        cancellationNoticeMinutes: 2880,
        closures: [{ startsAt: soon, endsAt: later }],
      });
      expect(JSON.stringify(detail.closures)).not.toContain('Mariage');
    });
  });
});
