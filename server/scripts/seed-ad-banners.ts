import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Puts the client's first three ad banners (scripts/assets/ads) into the three
 * placements of /admin/publicites, replacing the test photos and the
 * google.com links:
 *
 *   home_banner           → FLUXIA STUDIO   (small banner, image only)
 *   search_results        → @ngel FLORAL    (small banner, image only)
 *   booking_confirmation  → Tiime           (pop-up; its referral link goes in
 *                           from the admin once the client has sent it)
 *
 * Headline and link are left empty on purpose: both are optional, and an ad
 * without a link isn't clickable. Everything here is editable afterwards from
 * the admin: it reads and writes the same `ad_slots` rows and `admin-media`
 * bucket, and an admin change simply replaces what this script put there.
 *
 * Needs SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env, like the other seeds:
 *
 *   bun run seed:ads
 *
 * Idempotent: the images upload to fixed paths, so re-running replaces them
 * instead of piling up copies. Re-running also puts the three placements back
 * to these banners, undoing admin edits to them.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env — see .env.example.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = "admin-media";

const BANNERS = [
  { placement: "home_banner", file: "fluxia-studio.png" },
  { placement: "search_results", file: "angel-floral.png" },
  { placement: "booking_confirmation", file: "tiime.png" },
] as const;

async function main(): Promise<void> {
  for (const { placement, file } of BANNERS) {
    const path = `seed/ads/${file}`;
    const body = readFileSync(join(__dirname, "assets", "ads", file));

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, body, { contentType: "image/png", upsert: true });
    if (uploadError) throw new Error(`Upload of ${file} failed: ${uploadError.message}`);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("ad_slots")
      .update({ active: true, headline: "", image_url: data.publicUrl, link_url: null })
      .eq("id", placement);
    if (updateError) throw new Error(`Updating ${placement} failed: ${updateError.message}`);

    console.log(`${placement} ← ${file}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
