import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

export interface PlatformSettings {
  /** Free days a coiffeur's first subscription starts with, before the first charge. */
  trialDays: number;
}

interface PlatformSettingsRow {
  trial_days: number;
}

/** Same as schema.sql's column default, for a database where the row is missing. */
const DEFAULTS: PlatformSettings = { trialDays: 30 };

function mapRow(row: PlatformSettingsRow): PlatformSettings {
  return { trialDays: row.trial_days };
}

/**
 * What the admin tunes without a deploy (/admin/parametres): the single
 * `platform_settings` row. The commission on prestations joins it in Phase 5.
 */
@Injectable()
export class PlatformSettingsService {
  constructor(private readonly supabase: SupabaseService) {}

  async get(): Promise<PlatformSettings> {
    const { data, error } = await this.supabase.client.from('platform_settings').select().eq('id', true).maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data ? mapRow(data as PlatformSettingsRow) : DEFAULTS;
  }

  async update(patch: Partial<PlatformSettings>): Promise<PlatformSettings> {
    const { data, error } = await this.supabase.client
      .from('platform_settings')
      .update({ ...(patch.trialDays !== undefined ? { trial_days: patch.trialDays } : {}) })
      .eq('id', true)
      .select()
      .single();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return mapRow(data as PlatformSettingsRow);
  }
}
