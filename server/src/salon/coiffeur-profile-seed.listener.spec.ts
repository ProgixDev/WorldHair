import { EventEmitter2 } from '@nestjs/event-emitter';
import { CoiffeurApplicationsService } from '../coiffeur/coiffeur-applications.service';
import { SupabaseService } from '../database/supabase.service';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { CoiffeurProfileSeedListener } from './coiffeur-profile-seed.listener';
import { SalonService } from './salon.service';

const PROFILE_ID = 'coiffeur-1';

describe('CoiffeurProfileSeedListener', () => {
  let supabase: FakeSupabaseService;
  let applications: CoiffeurApplicationsService;
  let salon: SalonService;
  let listener: CoiffeurProfileSeedListener;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    applications = new CoiffeurApplicationsService(supabase as unknown as SupabaseService, new EventEmitter2());
    salon = new SalonService(supabase as unknown as SupabaseService);
    listener = new CoiffeurProfileSeedListener(applications, salon);
  });

  it("pre-fills Mon salon from the application on validation", async () => {
    supabase.seedApplication({
      profileId: PROFILE_ID,
      firstName: 'Sofia',
      lastName: 'Benali',
      salonName: 'Studio W',
      description: 'Coupe & couleur',
      phone: '+33612345678',
      addressLine: '12 rue des Lilas',
      postalCode: '75011',
      city: 'Paris',
      status: 'validated',
    });

    await listener.onDecided({ applicationId: 'app-1', profileId: PROFILE_ID, status: 'validated' });

    await expect(salon.getProfile(PROFILE_ID)).resolves.toMatchObject({
      salonName: 'Studio W',
      description: 'Coupe & couleur',
      phone: '+33612345678',
      addressLine: '12 rue des Lilas',
      postalCode: '75011',
      city: 'Paris',
    });
  });

  it('never overwrites a profile the coiffeur has already customized', async () => {
    supabase.seedApplication({ profileId: PROFILE_ID, firstName: 'Sofia', lastName: 'Benali', status: 'validated' });
    await salon.updateProfile(PROFILE_ID, { salonName: 'Already renamed' });

    await listener.onDecided({ applicationId: 'app-1', profileId: PROFILE_ID, status: 'validated' });

    await expect(salon.getProfile(PROFILE_ID)).resolves.toMatchObject({ salonName: 'Already renamed' });
  });

  it('does nothing on rejection', async () => {
    supabase.seedApplication({ profileId: PROFILE_ID, firstName: 'Sofia', lastName: 'Benali', status: 'rejected' });

    await listener.onDecided({ applicationId: 'app-1', profileId: PROFILE_ID, status: 'rejected' });

    await expect(salon.getProfile(PROFILE_ID)).resolves.toMatchObject({ salonName: '' });
  });

  it('does not throw for an unknown profile', async () => {
    await expect(
      listener.onDecided({ applicationId: 'app-1', profileId: 'unknown-profile', status: 'validated' }),
    ).resolves.toBeUndefined();
  });
});
