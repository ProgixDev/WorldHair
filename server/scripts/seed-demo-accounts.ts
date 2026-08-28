import { createClient } from "@supabase/supabase-js";

/**
 * Seeds the 4 preview/demo accounts the mobile app's DemoLoginBar signs into
 * (see mobile/src/services/auth.ts's DEMO_EMAILS) — one per account state:
 * a particulier, and a coiffeur in each of the three application states.
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY in .env: creating a login-capable auth user
 * requires the Admin API (`auth.admin.createUser`), which only works with
 * that key — a plain SQL insert into auth.users produces a user with no
 * usable password (see Supabase's own docs). Run once per fresh project:
 *
 *   bun run scripts/seed-demo-accounts.ts
 *
 * Idempotent: re-running updates the existing accounts rather than failing
 * on "already registered".
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

const DEMO_PASSWORD = "Demo1234!";

interface DemoAccount {
  email: string;
  role: "particulier" | "coiffeur";
  application?: {
    status: "pending" | "validated" | "rejected";
    reviewMessage?: string;
    shopProfileComplete?: boolean;
  };
}

const ACCOUNTS: DemoAccount[] = [
  { email: "demo.particulier@worldhair.app", role: "particulier" },
  {
    email: "demo.coiffeur.active@worldhair.app",
    role: "coiffeur",
    application: { status: "validated", shopProfileComplete: true },
  },
  {
    email: "demo.coiffeur.pending@worldhair.app",
    role: "coiffeur",
    application: { status: "pending" },
  },
  {
    email: "demo.coiffeur.rejected@worldhair.app",
    role: "coiffeur",
    application: {
      status: "rejected",
      reviewMessage: "Le diplôme envoyé est illisible. Merci de renvoyer une photo nette.",
    },
  },
];

async function findExistingUserId(email: string): Promise<string | null> {
  // No admin.getUserByEmail in supabase-js — page through listUsers instead.
  // Fine at this scale (a handful of demo accounts).
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

async function upsertAuthUser(email: string): Promise<string> {
  const existingId = await findExistingUserId(email);
  if (existingId) {
    console.log(`  ${email}: already exists (${existingId})`);
    return existingId;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  console.log(`  ${email}: created (${data.user.id})`);
  return data.user.id;
}

async function seedAccount(account: DemoAccount): Promise<void> {
  const userId = await upsertAuthUser(account.email);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ role: account.role })
    .eq("id", userId);
  if (profileError) throw profileError;

  if (account.application) {
    const { error: applicationError } = await supabase.from("coiffeur_applications").upsert(
      {
        profile_id: userId,
        first_name: "Sofia",
        last_name: "Benali",
        phone: "06 12 34 56 78",
        salon_name: "Studio W",
        description: "Coupe, coloration et coiffure afro dans un salon lumineux.",
        practice_zone: "salon",
        address_line: "12 rue des Lilas",
        postal_code: "75011",
        city: "Paris",
        // Demo-only placeholder paths — no real files were uploaded for these
        // seeded accounts, so nothing actually resolves in Storage.
        identity_document_path: `${userId}/identity.pdf`,
        diploma_document_path: `${userId}/diploma.pdf`,
        kbis_document_path: `${userId}/kbis.pdf`,
        invoice_document_path: `${userId}/invoice.pdf`,
        status: account.application.status,
        review_message: account.application.reviewMessage ?? null,
        shop_profile_complete: account.application.shopProfileComplete ?? false,
      },
      { onConflict: "profile_id" },
    );
    if (applicationError) throw applicationError;
  }
}

async function main(): Promise<void> {
  console.log("Seeding demo/preview accounts...\n");
  for (const account of ACCOUNTS) {
    await seedAccount(account);
  }
  console.log("\nDone. All demo accounts share the password:", DEMO_PASSWORD);
}

void main();
