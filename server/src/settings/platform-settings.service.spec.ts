import { SupabaseService } from '../database/supabase.service';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { PlatformSettingsService } from './platform-settings.service';

describe('PlatformSettingsService', () => {
  let supabase: FakeSupabaseService;
  let settings: PlatformSettingsService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    settings = new PlatformSettingsService(supabase as unknown as SupabaseService);
  });

  it('starts with a 30-day trial', async () => {
    await expect(settings.get()).resolves.toEqual({ trialDays: 30 });
  });

  it('keeps what the admin sets', async () => {
    await expect(settings.update({ trialDays: 14 })).resolves.toEqual({ trialDays: 14 });
    await expect(settings.get()).resolves.toEqual({ trialDays: 14 });
  });
});
