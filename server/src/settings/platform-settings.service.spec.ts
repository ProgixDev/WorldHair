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

  it('starts with a 30-day trial and a 10 % commission', async () => {
    await expect(settings.get()).resolves.toEqual({ trialDays: 30, commissionPercent: 10 });
  });

  it('keeps what the admin sets, one field at a time', async () => {
    await expect(settings.update({ trialDays: 14 })).resolves.toEqual({ trialDays: 14, commissionPercent: 10 });
    await expect(settings.update({ commissionPercent: 12.5 })).resolves.toEqual({ trialDays: 14, commissionPercent: 12.5 });
    await expect(settings.get()).resolves.toEqual({ trialDays: 14, commissionPercent: 12.5 });
  });
});
