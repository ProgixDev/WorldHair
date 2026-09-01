import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

export type AdPlacementId = 'home_banner' | 'search_results' | 'booking_confirmation';

export interface AdSlot {
  id: AdPlacementId;
  active: boolean;
  headline: string;
  imageUrl: string | null;
  linkUrl: string | null;
  updatedAt: string;
}

export interface UpdateAdSlotInput {
  active?: boolean;
  headline?: string;
  imageUrl?: string;
  linkUrl?: string;
}

interface AdSlotRow {
  id: AdPlacementId;
  active: boolean;
  headline: string;
  image_url: string | null;
  link_url: string | null;
  updated_at: string;
}

function mapRow(row: AdSlotRow): AdSlot {
  return {
    id: row.id,
    active: row.active,
    headline: row.headline,
    imageUrl: row.image_url,
    linkUrl: row.link_url,
    updatedAt: row.updated_at,
  };
}

/**
 * "Gestion des zones publicitaires" (TODO.md → Back-office admin, issue #5).
 * A fixed set of placements — see `../../schema.sql` — not a free-form CRUD:
 * `mobile/src/services/ads.ts` (the mock seam this replaces) only ever reads
 * these three ids.
 */
@Injectable()
export class AdSlotsService {
  constructor(private readonly supabase: SupabaseService) {}

  async listAll(): Promise<AdSlot[]> {
    const { data, error } = await this.supabase.client.from('ad_slots').select().order('id');
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data as AdSlotRow[]).map(mapRow);
  }

  async update(id: AdPlacementId, patch: UpdateAdSlotInput): Promise<AdSlot> {
    const row: Record<string, unknown> = {};
    if (patch.active !== undefined) row.active = patch.active;
    if (patch.headline !== undefined) row.headline = patch.headline;
    if (patch.imageUrl !== undefined) row.image_url = patch.imageUrl || null;
    if (patch.linkUrl !== undefined) row.link_url = patch.linkUrl || null;

    const { data, error } = await this.supabase.client
      .from('ad_slots')
      .update(row)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException('Ad slot not found.');
    }
    return mapRow(data as AdSlotRow);
  }
}
