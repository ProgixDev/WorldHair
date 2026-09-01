import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

export interface AppContent {
  key: string;
  heading: string;
  body: string;
  imageUrl: string | null;
  updatedAt: string;
}

export interface UpdateAppContentInput {
  heading?: string;
  body?: string;
  imageUrl?: string;
}

interface AppContentRow {
  key: string;
  heading: string;
  body: string;
  image_url: string | null;
  updated_at: string;
}

function mapRow(row: AppContentRow): AppContent {
  return {
    key: row.key,
    heading: row.heading,
    body: row.body,
    imageUrl: row.image_url,
    updatedAt: row.updated_at,
  };
}

/**
 * "Gestion de contenu / pages" (TODO.md → Back-office admin, issue #5). A
 * key/value table — see `../../schema.sql` — the only real key today is
 * `onboarding_products_slide`, read by `mobile/src/services/content.ts` (the
 * mock seam this replaces).
 */
@Injectable()
export class ContentService {
  constructor(private readonly supabase: SupabaseService) {}

  async get(key: string): Promise<AppContent> {
    const { data, error } = await this.supabase.client
      .from('app_content')
      .select()
      .eq('key', key)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException('Content not found.');
    }
    return mapRow(data as AppContentRow);
  }

  async update(key: string, patch: UpdateAppContentInput): Promise<AppContent> {
    const row: Record<string, unknown> = {};
    if (patch.heading !== undefined) row.heading = patch.heading;
    if (patch.body !== undefined) row.body = patch.body;
    if (patch.imageUrl !== undefined) row.image_url = patch.imageUrl || null;

    const { data, error } = await this.supabase.client
      .from('app_content')
      .update(row)
      .eq('key', key)
      .select()
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException('Content not found.');
    }
    return mapRow(data as AppContentRow);
  }
}
