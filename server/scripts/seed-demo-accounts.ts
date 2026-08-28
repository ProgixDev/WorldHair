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

interface DemoService {
  name: string;
  price: number;
  durationMin: number;
  specialty: string;
}

interface DemoAccount {
  email: string;
  role: "particulier" | "coiffeur";
  /** Particulier only — omitted entirely, status resolves to profile_incomplete. */
  profile?: { firstName: string; lastName: string };
  application?: {
    status: "pending" | "validated" | "rejected";
    reviewMessage?: string;
    shopProfileComplete?: boolean;
  };
  /**
   * Validated coiffeurs only — the ongoing "Mon salon" workspace (TODO.md →
   * Profils), separate from the one-time application above. Content mirrors
   * the mock catalogue's "Studio W" entry (mobile/src/features/salons/
   * data.ts) so the demo persona looks the same as it always did, now backed
   * by real coiffeur_profiles/coiffeur_availability/coiffeur_services rows.
   */
  salon?: {
    tagline: string;
    description: string;
    specialties: string[];
    services: DemoService[];
  };
}

const ACCOUNTS: DemoAccount[] = [
  {
    email: "demo.particulier@worldhair.app",
    role: "particulier",
    // "Profil complet → accueil" (see mobile's DEMO_PERSONAS hint) — a
    // blank profile would resolve to profile_incomplete and land on
    // profile-setup instead of /discover.
    profile: { firstName: "Camille", lastName: "Durand" },
  },
  {
    email: "demo.coiffeur.active@worldhair.app",
    role: "coiffeur",
    application: { status: "validated", shopProfileComplete: true },
    salon: {
      tagline: "Coupe sur-mesure & couleur douce",
      description:
        "Un atelier lumineux de deux fauteuils, pensé pour prendre le temps. Diagnostic complet avant chaque couleur, produits sans ammoniaque.",
      specialties: ["coupe", "coloration", "soins"],
      services: [
        { name: "Coupe & brushing", price: 40, durationMin: 45, specialty: "coupe" },
        { name: "Coupe homme", price: 28, durationMin: 30, specialty: "coupe" },
        { name: "Coloration complète", price: 75, durationMin: 90, specialty: "coloration" },
        { name: "Soin fondant", price: 35, durationMin: 30, specialty: "soins" },
      ],
    },
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

async function seedAccount(account: DemoAccount): Promise<string> {
  const userId = await upsertAuthUser(account.email);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      role: account.role,
      ...(account.profile
        ? { first_name: account.profile.firstName, last_name: account.profile.lastName }
        : {}),
    })
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

  if (account.salon) {
    await seedSalonWorkspace(userId, account.salon);
  }

  return userId;
}

/**
 * "Rendez-vous / Agenda" (TODO.md) is real now — gives both demo personas a
 * lived-in agenda via actual `appointments` rows instead of the old
 * client-side AsyncStorage trick (mobile/src/services/booking.ts used to do
 * this on first demo login; deleted once appointments moved server-side).
 */
interface AppointmentSeed {
  serviceIndex: number;
  /** Days from today; negative is in the past. */
  dayOffset: number;
  hour: number;
  minute: number;
  status: "pending" | "confirmed" | "refused" | "cancelled";
  note?: string;
}

const APPOINTMENT_SEEDS: AppointmentSeed[] = [
  {
    serviceIndex: 0,
    dayOffset: 2,
    hour: 10,
    minute: 0,
    status: "pending",
    note: "Première fois chez vous, on m'a beaucoup recommandé le salon.",
  },
  { serviceIndex: 1, dayOffset: 5, hour: 14, minute: 30, status: "confirmed" },
  // In the past — the API derives "confirmed and past" as "done" at read time.
  { serviceIndex: 2, dayOffset: -6, hour: 11, minute: 0, status: "confirmed" },
  { serviceIndex: 3, dayOffset: -13, hour: 16, minute: 0, status: "confirmed" },
  { serviceIndex: 0, dayOffset: -20, hour: 9, minute: 30, status: "cancelled" },
];

async function seedDemoAppointments(particulierId: string, coiffeurId: string): Promise<void> {
  const { data: services, error: servicesError } = await supabase
    .from("coiffeur_services")
    .select()
    .eq("profile_id", coiffeurId);
  if (servicesError) throw servicesError;
  if (!services || services.length === 0) return;

  // Replace rather than accumulate duplicates on re-run.
  const { error: deleteError } = await supabase
    .from("appointments")
    .delete()
    .eq("particulier_id", particulierId)
    .eq("coiffeur_id", coiffeurId);
  if (deleteError) throw deleteError;

  const rows = APPOINTMENT_SEEDS.map((seed) => {
    const service = services[seed.serviceIndex % services.length];
    const startsAt = new Date();
    startsAt.setDate(startsAt.getDate() + seed.dayOffset);
    startsAt.setHours(seed.hour, seed.minute, 0, 0);
    return {
      particulier_id: particulierId,
      coiffeur_id: coiffeurId,
      service_id: service.id as string,
      service_name: service.name as string,
      price: service.price,
      duration_min: service.duration_min,
      starts_at: startsAt.toISOString(),
      status: seed.status,
      client_note: seed.note ?? null,
    };
  });

  const { error: insertError } = await supabase.from("appointments").insert(rows);
  if (insertError) throw insertError;

  console.log(`  demo appointments seeded (${rows.length})`);
}

async function seedSalonWorkspace(
  userId: string,
  salon: NonNullable<DemoAccount["salon"]>,
): Promise<void> {
  const { error: profileError } = await supabase.from("coiffeur_profiles").upsert(
    {
      profile_id: userId,
      salon_name: "Studio W",
      tagline: salon.tagline,
      description: salon.description,
      address_line: "12 rue des Lilas",
      postal_code: "75011",
      city: "Paris",
      // Same address as the "Studio W" catalogue account (scripts/seed-catalogue-salons.ts) —
      // two separate accounts, coincidentally sharing a name and address by design.
      latitude: 48.8619,
      longitude: 2.3765,
      phone: "06 12 34 56 78",
      specialties: salon.specialties,
    },
    { onConflict: "profile_id" },
  );
  if (profileError) throw profileError;

  // Mon-Sat 9-19 with a lunch break, Sunday closed — same shape as
  // SalonService's own defaultAvailability(), just persisted for real.
  const week = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    profile_id: userId,
    weekday,
    is_open: weekday !== 0,
    opens_minute: 9 * 60,
    closes_minute: 19 * 60,
    break_start_minute: weekday === 0 ? null : 13 * 60,
    break_end_minute: weekday === 0 ? null : 14 * 60,
  }));
  const { error: availabilityError } = await supabase
    .from("coiffeur_availability")
    .upsert(week, { onConflict: "profile_id,weekday" });
  if (availabilityError) throw availabilityError;

  // Replace rather than accumulate duplicates on re-run: no unique
  // constraint on (profile_id, name) to upsert against, so clear first.
  const { error: deleteError } = await supabase
    .from("coiffeur_services")
    .delete()
    .eq("profile_id", userId);
  if (deleteError) throw deleteError;

  const { error: servicesError } = await supabase.from("coiffeur_services").insert(
    salon.services.map((service) => ({
      profile_id: userId,
      name: service.name,
      price: service.price,
      duration_min: service.durationMin,
      specialty: service.specialty,
    })),
  );
  if (servicesError) throw servicesError;

  console.log(`  ${userId}: salon workspace seeded (${salon.services.length} services)`);
}

async function main(): Promise<void> {
  console.log("Seeding demo/preview accounts...\n");
  const userIds = new Map<string, string>();
  for (const account of ACCOUNTS) {
    userIds.set(account.email, await seedAccount(account));
  }

  const particulierId = userIds.get("demo.particulier@worldhair.app");
  const coiffeurId = userIds.get("demo.coiffeur.active@worldhair.app");
  if (particulierId && coiffeurId) {
    await seedDemoAppointments(particulierId, coiffeurId);
  }

  console.log("\nDone. All demo accounts share the password:", DEMO_PASSWORD);
}

void main();
