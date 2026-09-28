import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

export interface PlatformSettings {
  /** Free days a coiffeur's first subscription starts with, before the first charge. */
  trialDays: number;
  /** WorldHair's share of each prestation paid in the app, in percent (Stripe's card fees come out of it). */
  commissionPercent: number;
}

interface PlatformSettingsRow {
  trial_days: number;
  commission_percent: number | string;
}

/** Same as schema.sql's column defaults, for a database where the row is missing. */
const DEFAULTS: PlatformSettings = { trialDays: 30, commissionPercent: 10 };

function mapRow(row: PlatformSettingsRow): PlatformSettings {
  // numeric columns come back as strings from PostgREST.
  return { trialDays: row.trial_days, commissionPercent: Number(row.commission_percent) };
}

/** What the admin tunes without a deploy (/admin/parametres): the single `platform_settings` row. */
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
      .update({
        ...(patch.trialDays !== undefined ? { trial_days: patch.trialDays } : {}),
        ...(patch.commissionPercent !== undefined ? { commission_percent: patch.commissionPercent } : {}),
      })
      .eq('id', true)
      .select()
      .single();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return mapRow(data as PlatformSettingsRow);
  }
}
