import { InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { isListed, SubscriptionRow } from '../../subscriptions/subscription-state';

/**
 * A salon without a live subscription (TODO.md Phase 4) disappears from
 * search — search_salons() joins on it — and, through this, from its public
 * page and from booking.
 */
export async function isSalonListed(supabase: SupabaseService, profileId: string): Promise<boolean> {
  const { data, error } = await supabase.client
    .from('coiffeur_subscriptions')
    .select()
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error) {
    throw new InternalServerErrorException(error.message);
  }
  return isListed(data as SubscriptionRow | null);
}
