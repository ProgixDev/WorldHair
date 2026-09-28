import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { DiscoveryService, SalonSummary } from '../discovery/discovery.service';

/** More than anyone keeps; the list is read in one search. */
const MAX_LISTED = 100;

/**
 * "Favoris" (TODO.md Phase 6): the salons a client keeps a heart on. Read
 * through search, so a salon that leaves WorldHair (unsubscribed,
 * suspended) drops out of the list on its own, and comes back if it returns.
 */
@Injectable()
export class FavoritesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly discovery: DiscoveryService,
  ) {}

  /** The latest first; distances from `origin` when given. */
  async list(particulierId: string, origin?: { lat: number; lng: number }): Promise<SalonSummary[]> {
    const { data, error } = await this.supabase.client
      .from('favorites')
      .select()
      .eq('particulier_id', particulierId)
      .order('created_at', { ascending: false })
      .limit(MAX_LISTED);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    const ids = (data as { coiffeur_id: string; created_at: string }[])
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((row) => row.coiffeur_id);
    if (ids.length === 0) return [];

    const { items } = await this.discovery.search({ ids, ...origin, limit: MAX_LISTED, offset: 0 });
    const byId = new Map(items.map((item) => [item.id, item]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }

  /** Once is enough: a second heart on the same salon changes nothing. */
  async add(particulierId: string, coiffeurId: string): Promise<void> {
    const { items } = await this.discovery.search({ ids: [coiffeurId], limit: 1, offset: 0, withNextSlots: false });
    if (items.length === 0) {
      throw new NotFoundException('Salon not found');
    }
    const { error } = await this.supabase.client
      .from('favorites')
      .upsert({ particulier_id: particulierId, coiffeur_id: coiffeurId }, { onConflict: 'particulier_id,coiffeur_id', ignoreDuplicates: true });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async remove(particulierId: string, coiffeurId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('favorites')
      .delete()
      .eq('particulier_id', particulierId)
      .eq('coiffeur_id', coiffeurId);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
