import { InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

/**
 * Suspended and banned accounts (admin → Comptes) disappear from search, the
 * public salon page and booking — not only from their own API access, which
 * SupabaseStrategy already blocks.
 */
export async function isAccountActive(supabase: SupabaseService, profileId: string): Promise<boolean> {
  const { data, error } = await supabase.client
    .from('profiles')
    .select('account_status')
    .eq('id', profileId)
    .maybeSingle();
  if (error) {
    throw new InternalServerErrorException(error.message);
  }
  return (data as { account_status: string } | null)?.account_status === 'active';
}
