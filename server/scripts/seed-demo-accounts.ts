import { createClient } from "@supabase/supabase-js";
import { parisParts, parisTime } from "../src/common/utils/paris-time";
import { TERMS_VERSION } from "../src/users/terms";
import { seedSalonReviews, upsertReviewers } from "./lib/seed-reviews";
import { offerSubscription } from "./lib/seed-subscription";

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
      // Accepted the terms in force, as the sign-up form would have: no new-terms screen in the way of a demo.
      terms_version: TERMS_VERSION,
      terms_accepted_at: new Date().toISOString(),
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
  /** Prestations in booking order — several run back to back as one appointment. */
  serviceIndexes: number[];
  /** Days from today; negative is in the past. */
  dayOffset: number;
  hour: number;
  minute: number;
  status: "pending" | "confirmed" | "refused" | "cancelled";
  note?: string;
  attendance?: "attended" | "no_show";
  /** Who cancelled it (TODO.md Phase 7), and WorldHair's reason when it did. */
  cancelledBy?: "client" | "salon" | "admin";
  cancellationReason?: string;
  /** Who of Studio W's team does it (TODO.md Phase 3): the owner unless « nadia ». */
  staff?: "nadia";
}

const APPOINTMENT_SEEDS: AppointmentSeed[] = [
  {
    serviceIndexes: [0],
    dayOffset: 2,
    hour: 10,
    minute: 0,
    status: "pending",
    note: "Première fois chez vous, on m'a beaucoup recommandé le salon.",
  },
  // Two prestations in one booking: Coloration complète + Soin fondant, 120 min.
  { serviceIndexes: [2, 3], dayOffset: 5, hour: 14, minute: 30, status: "confirmed" },
  // Studio W's colleague (TODO.md Phase 3): a request held on Nadia at the same
  // time as one of the owner's — two people, two bookings at once — and one of hers.
  { serviceIndexes: [1], dayOffset: 5, hour: 15, minute: 0, status: "pending", staff: "nadia" },
  { serviceIndexes: [0], dayOffset: 3, hour: 11, minute: 0, status: "confirmed", staff: "nadia" },
  { serviceIndexes: [3], dayOffset: -4, hour: 10, minute: 0, status: "confirmed", staff: "nadia" },
  // In the past — the API derives "confirmed and past" as "done" at read time.
  // Left unmarked, so demo.particulier can still review it by hand.
  { serviceIndexes: [2], dayOffset: -6, hour: 11, minute: 0, status: "confirmed" },
  { serviceIndexes: [3], dayOffset: -13, hour: 16, minute: 0, status: "confirmed", attendance: "attended" },
  { serviceIndexes: [0], dayOffset: -20, hour: 9, minute: 30, status: "cancelled", cancelledBy: "client" },
  // A dispute WorldHair settled from the back office (admin → Rendez-vous): both sides read the reason.
  {
    serviceIndexes: [1],
    dayOffset: -9,
    hour: 15,
    minute: 0,
    status: "cancelled",
    cancelledBy: "admin",
    cancellationReason: "Le salon était fermé à l'heure du rendez-vous : la cliente a trouvé porte close.",
  },
];

interface ChartAppointmentSeed {
  serviceIndex: number;
  /** 0 = January, in the current calendar year — AdminStatsService's month buckets are Jan–Dec of `now`. */
  month: number;
  day: number;
  status: "confirmed" | "cancelled";
}

/**
 * Backdated `created_at` spread across the whole year, purely so `/admin`'s
 * "Réservations" chart (AdminStatsService groups by `created_at`, not
 * `starts_at`) shows two full curves instead of one bump around whichever
 * month the script happened to run in.
 */
const CHART_APPOINTMENT_SEEDS: ChartAppointmentSeed[] = [
  { serviceIndex: 0, month: 0, day: 8, status: "confirmed" },
  { serviceIndex: 1, month: 0, day: 22, status: "confirmed" },
  { serviceIndex: 2, month: 1, day: 5, status: "confirmed" },
  { serviceIndex: 0, month: 1, day: 18, status: "confirmed" },
  { serviceIndex: 3, month: 1, day: 25, status: "cancelled" },
  { serviceIndex: 1, month: 2, day: 3, status: "confirmed" },
  { serviceIndex: 2, month: 2, day: 10, status: "confirmed" },
  { serviceIndex: 0, month: 2, day: 17, status: "confirmed" },
  { serviceIndex: 3, month: 2, day: 24, status: "confirmed" },
  { serviceIndex: 1, month: 2, day: 28, status: "cancelled" },
  { serviceIndex: 2, month: 3, day: 4, status: "confirmed" },
  { serviceIndex: 0, month: 3, day: 12, status: "confirmed" },
  { serviceIndex: 3, month: 3, day: 20, status: "confirmed" },
  { serviceIndex: 1, month: 3, day: 27, status: "cancelled" },
  { serviceIndex: 2, month: 4, day: 6, status: "confirmed" },
  { serviceIndex: 0, month: 4, day: 15, status: "confirmed" },
  { serviceIndex: 3, month: 5, day: 2, status: "confirmed" },
  { serviceIndex: 1, month: 5, day: 14, status: "confirmed" },
  { serviceIndex: 2, month: 6, day: 9, status: "confirmed" },
  { serviceIndex: 0, month: 6, day: 21, status: "confirmed" },
  { serviceIndex: 3, month: 6, day: 29, status: "cancelled" },
  { serviceIndex: 1, month: 7, day: 3, status: "confirmed" },
  { serviceIndex: 2, month: 7, day: 11, status: "confirmed" },
  { serviceIndex: 0, month: 7, day: 19, status: "confirmed" },
  { serviceIndex: 3, month: 7, day: 26, status: "confirmed" },
  { serviceIndex: 1, month: 8, day: 2, status: "cancelled" },
  { serviceIndex: 2, month: 8, day: 9, status: "confirmed" },
  { serviceIndex: 0, month: 8, day: 16, status: "confirmed" },
  { serviceIndex: 3, month: 9, day: 5, status: "confirmed" },
  { serviceIndex: 1, month: 9, day: 18, status: "confirmed" },
  { serviceIndex: 2, month: 9, day: 27, status: "cancelled" },
  { serviceIndex: 0, month: 10, day: 8, status: "confirmed" },
  { serviceIndex: 3, month: 10, day: 21, status: "confirmed" },
  { serviceIndex: 1, month: 11, day: 6, status: "confirmed" },
  { serviceIndex: 2, month: 11, day: 15, status: "confirmed" },
  { serviceIndex: 0, month: 11, day: 24, status: "cancelled" },
];

async function seedDemoAppointments(particulierId: string, coiffeurId: string, team: DemoTeam): Promise<void> {
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

  // Like POST /appointments: a booking keeps the salon's cancellation notice as it stood when booked.
  const { data: salonProfile, error: salonProfileError } = await supabase
    .from("coiffeur_profiles")
    .select("cancellation_notice_minutes")
    .eq("profile_id", coiffeurId)
    .single();
  if (salonProfileError) throw salonProfileError;

  // Hours are Paris wall-clock times, whatever timezone the seeding machine is in.
  const today = parisParts(new Date());
  for (const seed of APPOINTMENT_SEEDS) {
    const picked = seed.serviceIndexes.map((index) => services[index % services.length]);
    const startsAt = parisTime(today.year, today.month, today.day + seed.dayOffset, seed.hour, seed.minute);
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .insert({
        particulier_id: particulierId,
        coiffeur_id: coiffeurId,
        staff_id: seed.staff === "nadia" ? team.nadia : team.owner,
        service_id: picked[0].id as string,
        service_name: picked.map((service) => service.name as string).join(" + "),
        price: picked.reduce((sum, service) => sum + Number(service.price), 0),
        duration_min: picked.reduce((sum, service) => sum + (service.duration_min as number), 0),
        starts_at: startsAt.toISOString(),
        status: seed.status,
        client_note: seed.note ?? null,
        attendance: seed.attendance ?? null,
        cancellation_notice_minutes: salonProfile.cancellation_notice_minutes,
        cancelled_by: seed.cancelledBy ?? null,
        cancellation_reason: seed.cancellationReason ?? null,
      })
      .select("id")
      .single();
    if (appointmentError) throw appointmentError;

    const { error: linesError } = await supabase.from("appointment_services").insert(
      picked.map((service, position) => ({
        appointment_id: appointment.id,
        service_id: service.id,
        service_name: service.name,
        price: service.price,
        duration_min: service.duration_min,
        position,
      })),
    );
    if (linesError) throw linesError;
  }

  // 06:00 UTC is before any salon opens, so these chart-only rows can never
  // overlap an agenda booking above (the database refuses overlapping bookings).
  const year = new Date().getUTCFullYear();
  const chartRows = CHART_APPOINTMENT_SEEDS.map((seed) => {
    const service = services[seed.serviceIndex % services.length];
    const at = new Date(Date.UTC(year, seed.month, seed.day, 6, 0, 0)).toISOString();
    return {
      particulier_id: particulierId,
      coiffeur_id: coiffeurId,
      staff_id: team.owner,
      service_id: service.id as string,
      service_name: service.name as string,
      price: service.price,
      duration_min: service.duration_min,
      starts_at: at,
      status: seed.status,
      cancelled_by: seed.status === "cancelled" ? "client" : null,
      client_note: null,
      created_at: at,
    };
  });

  const { error: insertError } = await supabase.from("appointments").insert(chartRows);
  if (insertError) throw insertError;

  console.log(
    `  demo appointments seeded (${APPOINTMENT_SEEDS.length} agenda + ${chartRows.length} chart-only)`,
  );
}

interface DemoTeam {
  owner: string;
  nadia: string;
}

const STAFF_EMAIL = "demo.coiffeur.equipe@worldhair.app";

/**
 * Studio W's team (TODO.md Phase 3): its owner, and Nadia — a coiffeur who
 * joined with a code (her own account, role 'staff', sign in with
 * demo.coiffeur.equipe@…) — on the salon's hours but for her own congé, so
 * « Équipe », « Qui s'en occupe ? » and the staff app have something to show.
 * Run after seedDemoClosures, which clears every closure of the salon.
 */
async function seedDemoTeam(coiffeurId: string): Promise<DemoTeam> {
  const nadiaId = await upsertAuthUser(STAFF_EMAIL);
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      role: "staff",
      first_name: "Nadia",
      last_name: "Kaci",
      terms_version: TERMS_VERSION,
      terms_accepted_at: new Date().toISOString(),
    })
    .eq("id", nadiaId);
  if (profileError) throw profileError;

  const { data: members, error: teamError } = await supabase
    .from("salon_staff")
    .upsert(
      [
        { salon_id: coiffeurId, profile_id: coiffeurId, position: 0 },
        { salon_id: coiffeurId, profile_id: nadiaId, position: 1 },
      ],
      { onConflict: "profile_id" },
    )
    .select("id, profile_id");
  if (teamError) throw teamError;
  const idOf = (profileId: string) => (members as { id: string; profile_id: string }[]).find((member) => member.profile_id === profileId)!.id;
  const team = { owner: idOf(coiffeurId), nadia: idOf(nadiaId) };

  // On the salon's hours: no week of her own.
  const { error: weekError } = await supabase.from("staff_availability").delete().eq("staff_id", team.nadia);
  if (weekError) throw weekError;

  const today = parisParts(new Date());
  const { error: offError } = await supabase.from("coiffeur_time_off").insert({
    profile_id: coiffeurId,
    staff_id: team.nadia,
    starts_at: parisTime(today.year, today.month, today.day + 10).toISOString(),
    ends_at: parisTime(today.year, today.month, today.day + 11).toISOString(),
    label: "Congés Nadia",
  });
  if (offError) throw offError;

  console.log(`  demo team seeded (owner + Nadia, ${STAFF_EMAIL})`);
  return team;
}

/**
 * Two upcoming closures so "Congés et fermetures" isn't empty: a few hours
 * one afternoon, and two whole days. Neither overlaps the agenda above.
 */
async function seedDemoClosures(coiffeurId: string): Promise<void> {
  const { error: deleteError } = await supabase.from("coiffeur_time_off").delete().eq("profile_id", coiffeurId);
  if (deleteError) throw deleteError;

  const today = parisParts(new Date());
  const { error } = await supabase.from("coiffeur_time_off").insert([
    {
      profile_id: coiffeurId,
      starts_at: parisTime(today.year, today.month, today.day + 8, 14, 0).toISOString(),
      ends_at: parisTime(today.year, today.month, today.day + 8, 19, 0).toISOString(),
      label: "Formation",
    },
    {
      profile_id: coiffeurId,
      starts_at: parisTime(today.year, today.month, today.day + 15).toISOString(),
      ends_at: parisTime(today.year, today.month, today.day + 17).toISOString(),
      label: "Congés",
    },
  ]);
  if (error) throw error;
  console.log("  demo closures seeded (1 afternoon + 2 days)");
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
      // Demo handles — shown as icons on the salon page (TODO.md Phase 6).
      instagram_url: "https://instagram.com/studio.w.demo",
      tiktok_url: "https://www.tiktok.com/@studio.w.demo",
      facebook_url: null,
      website_url: null,
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

  const { error: servicesError } = await supabase.from("coiffeur_services").insert([
    ...salon.services.map((service) => ({
      profile_id: userId,
      name: service.name,
      price: service.price,
      duration_min: service.durationMin,
      specialty: service.specialty,
      is_active: true,
    })),
    // Hidden (TODO.md Phase 6): in the coiffeur's list, nowhere for clients.
    { profile_id: userId, name: "Lissage brésilien", price: 150, duration_min: 150, specialty: "soins", is_active: false },
  ]);
  if (servicesError) throw servicesError;

  await offerSubscription(supabase, userId);

  // Bookable without the salon's own Stripe payouts, so paying in the app can be
  // tried end to end; a real onboarding later (test mode) takes over.
  const { error: payoutError } = await supabase
    .from("coiffeur_payout_accounts")
    .upsert({ profile_id: userId, bookable_without_payouts: true }, { onConflict: "profile_id" });
  if (payoutError) throw payoutError;

  console.log(`  ${userId}: salon workspace seeded (${salon.services.length} services + 1 hidden, offered subscription)`);
}

/**
 * One of Studio W's reviews reported by two readers (TODO.md Phase 7), so the
 * admins' « Avis » queue shows who reported it and why. Reseeded with the
 * reviews: they're recreated on every run, their reports with them.
 */
async function seedDemoReports(particulierId: string, coiffeurId: string, reviewerIds: string[]): Promise<number> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, particulier_id")
    .eq("coiffeur_id", coiffeurId)
    .in("particulier_id", reviewerIds)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const review = (data as { id: string; particulier_id: string }[])[0];
  const otherReader = reviewerIds.find((id) => id !== review?.particulier_id);
  if (!review || !otherReader) return 0;

  const reports = [
    { review_id: review.id, reporter_id: particulierId, reason: "fake", details: "Trop élogieux pour être vrai, sans doute écrit par le salon." },
    { review_id: review.id, reporter_id: otherReader, reason: "spam", details: null },
  ];
  const { error: reportsError } = await supabase
    .from("review_reports")
    .upsert(reports, { onConflict: "review_id,reporter_id", ignoreDuplicates: true });
  if (reportsError) throw reportsError;
  // As POST /reviews/:id/report leaves it: in the admins' queue, still shown to everyone.
  const { error: flagError } = await supabase
    .from("reviews")
    .update({ status: "reported", report_reason: "spam", reported_at: new Date().toISOString() })
    .eq("id", review.id);
  if (flagError) throw flagError;
  return reports.length;
}

/** Hearts on Studio W and two catalogue salons, when `seed:catalogue` has run (TODO.md Phase 6). */
async function seedDemoFavorites(particulierId: string, coiffeurId: string): Promise<number> {
  const { data, error } = await supabase
    .from("coiffeur_profiles")
    .select("profile_id")
    .in("salon_name", ["Racines", "Maison Tresse"]);
  if (error) throw error;
  const ids = [coiffeurId, ...(data as { profile_id: string }[]).map((row) => row.profile_id)];
  const { error: favoritesError } = await supabase
    .from("favorites")
    .upsert(
      ids.map((id) => ({ particulier_id: particulierId, coiffeur_id: id })),
      { onConflict: "particulier_id,coiffeur_id", ignoreDuplicates: true },
    );
  if (favoritesError) throw favoritesError;
  return ids.length;
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
    await seedDemoClosures(coiffeurId);
    const team = await seedDemoTeam(coiffeurId);
    await seedDemoAppointments(particulierId, coiffeurId, team);
    // Written by the six client.* accounts, never demo.particulier — its own
    // past appointments stay free to review by hand.
    const reviewerIds = await upsertReviewers(supabase);
    const reviews = await seedSalonReviews(supabase, {
      coiffeurId,
      salonKey: "studio-w-demo",
      targetRating: 4.9,
      reviewerIds,
    });
    console.log(`  demo salon reviews seeded (${reviews})`);
    console.log(`  demo review reports seeded (${await seedDemoReports(particulierId, coiffeurId, reviewerIds)})`);
    console.log(`  demo client favorites seeded (${await seedDemoFavorites(particulierId, coiffeurId)})`);
  }

  console.log("\nDone. All demo accounts share the password:", DEMO_PASSWORD);
}

void main();
