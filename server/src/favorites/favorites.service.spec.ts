import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NextSlotService } from '../appointments/next-slot.service';
import { CoiffeurApplicationsService } from '../coiffeur/coiffeur-applications.service';
import { EnvironmentVariables } from '../config/env.validation';
import { SupabaseService } from '../database/supabase.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { PayoutAccountsService } from '../payments/payout-accounts.service';
import { SalonService } from '../salon/salon.service';
import { StripeService } from '../stripe/stripe.service';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { FavoritesService } from './favorites.service';
import { StaffService } from '../staff/staff.service';

const CLIENT_ID = 'client-1';

describe('FavoritesService', () => {
  let supabase: FakeSupabaseService;
  let favorites: FavoritesService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    const salon = new SalonService(supabase as unknown as SupabaseService);
    const config = { get: () => '' } as unknown as ConfigService<EnvironmentVariables, true>;
    const discovery = new DiscoveryService(
      supabase as unknown as SupabaseService,
      new CoiffeurApplicationsService(supabase as unknown as SupabaseService, new EventEmitter2()),
      salon,
      new PayoutAccountsService(supabase as unknown as SupabaseService, new StripeService(null, config), config),
      new NextSlotService(supabase as unknown as SupabaseService, salon, new StaffService(supabase as unknown as SupabaseService, new EventEmitter2())),
    );
    favorites = new FavoritesService(supabase as unknown as SupabaseService, discovery);
    for (const id of ['salon-a', 'salon-b', 'salon-c']) {
      supabase.seedValidatedSalon({ profileId: id, firstName: 'Sofia', lastName: 'Benali', salonName: id });
    }
  });

  it('keeps the salons a client likes, the latest first, once each', async () => {
    await favorites.add(CLIENT_ID, 'salon-a');
    await favorites.add(CLIENT_ID, 'salon-c');
    await favorites.add(CLIENT_ID, 'salon-a');

    const mine = await favorites.list(CLIENT_ID);

    expect(mine.map((salon) => salon.id)).toEqual(['salon-c', 'salon-a']);
    await expect(favorites.list('someone-else')).resolves.toEqual([]);
  });

  it('forgets one on request, and says nothing when it was not there', async () => {
    await favorites.add(CLIENT_ID, 'salon-a');

    await favorites.remove(CLIENT_ID, 'salon-a');
    await favorites.remove(CLIENT_ID, 'salon-b');

    await expect(favorites.list(CLIENT_ID)).resolves.toEqual([]);
  });

  it('only takes salons clients can see, and drops one that leaves WorldHair from the list', async () => {
    await expect(favorites.add(CLIENT_ID, 'no-such-salon')).rejects.toThrow(NotFoundException);

    await favorites.add(CLIENT_ID, 'salon-b');
    supabase.setAccountStatus('salon-b', 'suspended');

    await expect(favorites.list(CLIENT_ID)).resolves.toEqual([]);
  });
});
