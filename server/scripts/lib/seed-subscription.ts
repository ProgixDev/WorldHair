import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A salon is only listed with a live subscription (TODO.md Phase 4). Seeded
 * salons get an offered one — no Stripe, a year long — unless the coiffeur
 * already subscribed through Stripe Checkout (test mode), which re-seeding
 * must never undo.
 */
export async function offerSubscription(
  supabase: SupabaseClient,
  profileId: string,
  tier: "solo" | "team" = "solo",
): Promise<void> {
  const { data: existing, error: readError } = await supabase
    .from("coiffeur_subscriptions")
    .select("stripe_subscription_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (readError) throw readError;
  if (existing?.stripe_subscription_id) return;

  const { error } = await supabase.from("coiffeur_subscriptions").upsert(
    {
      profile_id: profileId,
      plan: "monthly",
      tier,
      status: "active",
      trial_ends_at: null,
      cancel_at: null,
      current_period_end: new Date(Date.now() + 365 * 86_400_000).toISOString(),
    },
    { onConflict: "profile_id" },
  );
  if (error) throw error;
}
