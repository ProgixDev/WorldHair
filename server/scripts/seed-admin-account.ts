import { createClient } from "@supabase/supabase-js";

/**
 * Creates the one real admin account the web admin panel signs into
 * (web/src/app/login) — there's no admin signup path anywhere in this
 * product, `profiles.role='admin'` only ever gets set here. Same
 * Admin-API-required pattern as seed-demo-accounts.ts (a plain SQL insert
 * into auth.users produces a user with no usable password). Run once per
 * fresh project:
 *
 *   bun run scripts/seed-admin-account.ts
 *
 * Idempotent: re-running just confirms the role, doesn't error on "already
 * registered".
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

const ADMIN_EMAIL = "admin@admin.com";
const ADMIN_PASSWORD = "admin123";

async function findExistingUserId(email: string): Promise<string | null> {
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function main(): Promise<void> {
  console.log("Seeding admin account...\n");

  let userId = await findExistingUserId(ADMIN_EMAIL);
  if (userId) {
    console.log(`  ${ADMIN_EMAIL}: already exists (${userId})`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`  ${ADMIN_EMAIL}: created (${userId})`);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", userId);
  if (profileError) throw profileError;

  console.log(`\nDone. Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

void main();
