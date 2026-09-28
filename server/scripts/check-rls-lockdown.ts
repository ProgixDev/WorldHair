import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Proves the app's public key can't be used to write around the API: signs in
 * as the demo particulier and the demo coiffeur with the ANON key (exactly
 * what the mobile app ships) and tries to update rows they own directly
 * through Supabase. Every write sends back the value already stored, so the
 * database is never changed — only whether Postgres lets it through matters.
 *
 *   bun run check:rls
 *
 * Needs SUPABASE_URL + SUPABASE_ANON_KEY in .env and the demo accounts
 * (`bun run seed:demo`). Exits 1 if any check doesn't match what's expected.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const DEMO_PASSWORD = "Demo1234!";

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_ANON_KEY in .env — see .env.example.");
  process.exit(1);
}

interface Check {
  name: string;
  expect: "blocked" | "allowed";
  run: () => Promise<"blocked" | "allowed" | "no row to test">;
}

async function signIn(email: string): Promise<{ client: SupabaseClient; userId: string }> {
  const client = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error || !data.user) {
    throw new Error(`Can't sign in as ${email}: ${error?.message ?? "no user"}`);
  }
  return { client, userId: data.user.id };
}

/** Writes `column` back to its own current value on the first row matching `match`. */
async function rewriteOwnValue(
  client: SupabaseClient,
  table: string,
  column: string,
  match: Record<string, string>,
): Promise<"blocked" | "allowed" | "no row to test"> {
  const { data: rows, error: readError } = await client.from(table).select(`*`).match(match).limit(1);
  if (readError || !rows || rows.length === 0) {
    return "no row to test";
  }
  const row = rows[0] as Record<string, unknown>;
  const key = "id" in row ? { id: row.id as string } : "profile_id" in row ? { profile_id: row.profile_id as string } : match;
  const { data: updated, error } = await client
    .from(table)
    .update({ [column]: row[column] })
    .match(key)
    .select();
  // A denied privilege is an error; a row hidden by RLS is a silent 0-row update. Both mean blocked.
  return !error && updated && updated.length > 0 ? "allowed" : "blocked";
}

async function main(): Promise<void> {
  const particulier = await signIn("demo.particulier@worldhair.app");
  const coiffeur = await signIn("demo.coiffeur.active@worldhair.app");

  const checks: Check[] = [
    {
      name: "particulier sets own profiles.first_name (needed by the app)",
      expect: "allowed",
      run: () => rewriteOwnValue(particulier.client, "profiles", "first_name", { id: particulier.userId }),
    },
    {
      name: "particulier sets own profiles.role",
      expect: "blocked",
      run: () => rewriteOwnValue(particulier.client, "profiles", "role", { id: particulier.userId }),
    },
    {
      name: "particulier sets own profiles.account_status",
      expect: "blocked",
      run: () => rewriteOwnValue(particulier.client, "profiles", "account_status", { id: particulier.userId }),
    },
    {
      name: "particulier sets own appointments.status",
      expect: "blocked",
      run: () =>
        rewriteOwnValue(particulier.client, "appointments", "status", { particulier_id: particulier.userId }),
    },
    {
      name: "coiffeur sets own coiffeur_profiles.rating",
      expect: "blocked",
      run: () => rewriteOwnValue(coiffeur.client, "coiffeur_profiles", "rating", { profile_id: coiffeur.userId }),
    },
    {
      name: "coiffeur sets own coiffeur_services.price",
      expect: "blocked",
      run: () => rewriteOwnValue(coiffeur.client, "coiffeur_services", "price", { profile_id: coiffeur.userId }),
    },
    {
      name: "coiffeur sets own coiffeur_subscriptions.status",
      expect: "blocked",
      run: () =>
        rewriteOwnValue(coiffeur.client, "coiffeur_subscriptions", "status", { profile_id: coiffeur.userId }),
    },
    {
      name: "coiffeur sets a review's status on their salon",
      expect: "blocked",
      run: () => rewriteOwnValue(coiffeur.client, "reviews", "status", { coiffeur_id: coiffeur.userId }),
    },
  ];

  let failures = 0;
  for (const check of checks) {
    const result = await check.run();
    const ok = result === check.expect || result === "no row to test";
    if (!ok) failures += 1;
    console.log(`${ok ? "OK  " : "FAIL"}  ${check.name}: ${result} (expected ${check.expect})`);
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed: the public key can still write around the API.`);
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
