import { InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { isListed, SubscriptionRow } from '../../subscriptions/subscription-state';

export async function findSalonSubscription(
  supabase: SupabaseService,
  profileId: string,
): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase.client
    .from('coiffeur_subscriptions')
    .select()
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error) {
    throw new InternalServerErrorException(error.message);
  }
  return data as SubscriptionRow | null;
}

/**
 * A salon without a live subscription (TODO.md Phase 4) disappears from
 * search — search_salons() joins on it — and, through this, from its public
 * page and from booking.
 */
export async function isSalonListed(supabase: SupabaseService, profileId: string): Promise<boolean> {
  return isListed(await findSalonSubscription(supabase, profileId));
}
