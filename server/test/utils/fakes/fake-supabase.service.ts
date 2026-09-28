import { randomUUID } from 'crypto';
import { parisParts, parisTime } from '../../../src/common/utils/paris-time';

export interface FakeAuthUser {
  id: string;
  email: string;
  email_confirmed_at: string | null;
}

interface ProfileRow {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  role: string;
  account_status: string;
}

interface QueryResult {
  data: unknown;
  error: { code?: string; message: string } | null;
}

interface CoiffeurApplicationRow {
  id: string;
  profile_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  salon_name: string;
  description: string;
  practice_zone: string;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  invoice_document_path: string | null;
  travel_radius_km: number | null;
  identity_document_path: string;
  diploma_document_path: string;
  kbis_document_path: string;
  status: string;
  review_message: string | null;
  shop_profile_complete: boolean;
  submitted_at: string;
  reviewed_at: string | null;
}

interface SalonProfileRow {
  profile_id: string;
  salon_name: string;
  tagline: string;
  description: string;
  address_line: string;
  postal_code: string;
  city: string;
  phone: string;
  specialties: string[];
  cover_url: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number;
  review_count: number;
  badges: string[];
  confirmation_mode: string;
  booking_notice_minutes: number;
  cancellation_notice_minutes: number;
  practice_zone: string;
  travel_radius_km: number | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  website_url: string | null;
}

interface TimeOffRow {
  id: string;
  profile_id: string;
  staff_id: string | null;
  starts_at: string;
  ends_at: string;
  label: string;
  created_at: string;
}

/** Great-circle distance in km — good enough for fake-backed test assertions; ST_Distance does the real math. */
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

interface AvailabilityRow {
  profile_id: string;
  weekday: number;
  is_open: boolean;
  opens_minute: number;
  closes_minute: number;
  break_start_minute: number | null;
  break_end_minute: number | null;
}

interface ServiceRow {
  id: string;
  profile_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_min: number;
  specialty: string;
  is_active: boolean;
}

interface GalleryPhotoRow {
  id: string;
  profile_id: string;
  url: string;
  storage_path: string;
  created_at: string;
}

interface AppointmentRow {
  id: string;
  particulier_id: string;
  coiffeur_id: string;
  service_id: string | null;
  service_name: string;
  price: number;
  duration_min: number;
  starts_at: string;
  status: string;
  client_note: string | null;
  attendance: string | null;
  cancellation_notice_minutes: number | null;
  moved_by_salon: boolean;
  created_at: string;
}

interface AppointmentServiceRow {
  id: string;
  appointment_id: string;
  service_id: string | null;
  service_name: string;
  price: number;
  duration_min: number;
  position: number;
}

interface ReviewRow {
  id: string;
  appointment_id: string;
  particulier_id: string;
  coiffeur_id: string;
  rating: number;
  tags: string[];
  comment: string;
  coiffeur_reply: string | null;
  replied_at: string | null;
  status: string;
  report_reason: string | null;
  reported_at: string | null;
  created_at: string;
}

interface PushTokenRow {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  timezone: string;
  last_seen_at: string;
  invalidated_at: string | null;
  created_at: string;
}

interface NotificationPreferencesRow {
  user_id: string;
  reminder_day_before: boolean;
  reminder_hour_before: boolean;
  updated_at: string;
}

interface NotificationLogRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  dedupe_key: string;
  created_at: string;
}

interface SubscriptionRow {
  profile_id: string;
  plan: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PlatformSettingsRow {
  id: true;
  trial_days: number;
  commission_percent: number;
  updated_at: string;
}

/** Same defaults as schema.sql's platform_settings row. */
function defaultPlatformSettings(): PlatformSettingsRow {
  return { id: true, trial_days: 30, commission_percent: 10, updated_at: new Date().toISOString() };
}

interface PayoutAccountRow {
  profile_id: string;
  stripe_account_id: string | null;
  details_submitted: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  bookable_without_payouts: boolean;
  created_at: string;
  updated_at: string;
}

interface PaymentRow {
  id: string;
  appointment_id: string;
  particulier_id: string;
  coiffeur_id: string;
  /** Known once the client paid on Stripe's page. */
  payment_intent_id: string | null;
  checkout_session_id: string | null;
  charge_id: string | null;
  amount: number;
  currency: string;
  commission_rate: number;
  commission_amount: number;
  status: string;
  refunded_amount: number;
  transfer_id: string | null;
  transfer_amount: number | null;
  transferred_at: string | null;
  transfer_attempted_at: string | null;
  reversed_amount: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

interface ReviewReportRow {
  review_id: string;
  reporter_id: string;
  reason: string;
  details: string | null;
  created_at: string;
}

interface FavoriteRow {
  particulier_id: string;
  coiffeur_id: string;
  created_at: string;
}

/** Mirrors search_salons()'s subscription join: Stripe's live statuses (period not over by 3+ days), or an offered one until its end date. */
function isListedSubscription(row: SubscriptionRow | undefined): boolean {
  if (!row || !['trialing', 'active', 'past_due'].includes(row.status)) return false;
  const periodEnd = row.current_period_end === null ? null : new Date(row.current_period_end).getTime();
  if (row.stripe_subscription_id !== null) return periodEnd === null || periodEnd > Date.now() - 3 * 86_400_000;
  return periodEnd !== null && periodEnd > Date.now();
}

interface AdSlotRow {
  id: string;
  active: boolean;
  headline: string;
  image_url: string | null;
  link_url: string | null;
  updated_at: string;
}

interface AppContentRow {
  key: string;
  heading: string;
  body: string;
  image_url: string | null;
  updated_at: string;
}

/** Mirrors schema.sql's seed inserts for these two tables. */
function defaultAdSlots(): [string, AdSlotRow][] {
  const now = new Date().toISOString();
  return [
    ['home_banner', { id: 'home_banner', active: false, headline: 'Nos partenaires beauté', image_url: null, link_url: null, updated_at: now }],
    ['search_results', { id: 'search_results', active: false, headline: 'Découvrez nos marques partenaires', image_url: null, link_url: null, updated_at: now }],
    ['booking_confirmation', { id: 'booking_confirmation', active: false, headline: 'Prenez soin de vos cheveux entre deux rendez-vous', image_url: null, link_url: null, updated_at: now }],
  ];
}

function defaultAppContent(): [string, AppContentRow][] {
  const now = new Date().toISOString();
  return [
    [
      'onboarding_products_slide',
      {
        key: 'onboarding_products_slide',
        heading: 'Des produits de qualité',
        body: 'Nos coiffeurs travaillent avec des marques professionnelles, choisies pour prendre soin de chaque type de cheveux.',
        image_url: null,
        updated_at: now,
      },
    ],
  ];
}

/** PostgREST's default max-rows (Supabase → API settings): no select returns more, whatever range it asks for. */
const MAX_ROWS = 1000;

function matchesAll<TRow extends object>(row: TRow, filters: [keyof TRow, unknown][]): boolean {
  return filters.every(([column, value]) => row[column] === value);
}

/** Numbers as numbers, ISO timestamps as dates, anything else with `<`/`>`. */
function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const aDate = new Date(a as string).getTime();
  const bDate = new Date(b as string).getTime();
  if (!Number.isNaN(aDate) && !Number.isNaN(bDate)) return aDate - bDate;
  if ((a as number) < (b as number)) return -1;
  if ((a as number) > (b as number)) return 1;
  return 0;
}

/**
 * Hand-rolled stand-in for the `.select().eq().order().range()`-shaped
 * queries this codebase's services build — a hard-coded shape (like the
 * rest of this file), not a general query engine. Every intermediate step
 * is itself awaitable (`then`), matching how supabase-js's real builders
 * work: `await query` and `await query.eq(...)` both resolve.
 */
class FakeSelectQuery<TRow extends object> implements PromiseLike<QueryResult> {
  private readonly eqFilters: [keyof TRow, unknown][] = [];
  private readonly inFilters: [keyof TRow, unknown[]][] = [];
  private readonly isFilters: [keyof TRow, null][] = [];
  private readonly gteFilters: [keyof TRow, unknown][] = [];
  private readonly lteFilters: [keyof TRow, unknown][] = [];
  private readonly ltFilters: [keyof TRow, unknown][] = [];
  private rangeFrom = 0;
  private rangeTo = Number.MAX_SAFE_INTEGER;

  constructor(private readonly rows: () => TRow[]) {}

  eq(column: keyof TRow, value: unknown): this {
    this.eqFilters.push([column, value]);
    return this;
  }

  in(column: keyof TRow, values: unknown[]): this {
    this.inFilters.push([column, values]);
    return this;
  }

  /** Only `.is(column, null)` is used anywhere in this codebase — that's all this fakes. */
  is(column: keyof TRow, value: null): this {
    this.isFilters.push([column, value]);
    return this;
  }

  gte(column: keyof TRow, value: unknown): this {
    this.gteFilters.push([column, value]);
    return this;
  }

  lte(column: keyof TRow, value: unknown): this {
    this.lteFilters.push([column, value]);
    return this;
  }

  lt(column: keyof TRow, value: unknown): this {
    this.ltFilters.push([column, value]);
    return this;
  }

  order(): this {
    return this; // Rows are already read back in insertion order.
  }

  range(from: number, to: number): this {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  /** Only ever called without `.range()` alongside it anywhere in this codebase. */
  limit(count: number): this {
    this.rangeTo = Math.min(this.rangeTo, count - 1);
    return this;
  }

  private filtered(): TRow[] {
    const rows = this.rows()
      .filter((row) => matchesAll(row, this.eqFilters))
      .filter((row) => this.inFilters.every(([column, values]) => values.includes(row[column])))
      .filter((row) => this.isFilters.every(([column]) => row[column] === null))
      .filter((row) => this.gteFilters.every(([column, value]) => compareValues(row[column], value) >= 0))
      .filter((row) => this.lteFilters.every(([column, value]) => compareValues(row[column], value) <= 0))
      .filter((row) => this.ltFilters.every(([column, value]) => compareValues(row[column], value) < 0));
    return rows.slice(this.rangeFrom, Math.min(this.rangeTo + 1, this.rangeFrom + MAX_ROWS));
  }

  async maybeSingle(): Promise<QueryResult> {
    return { data: this.filtered()[0] ?? null, error: null };
  }

  async single(): Promise<QueryResult> {
    const [row] = this.filtered();
    return row ? { data: row, error: null } : { data: null, error: { message: 'no rows found' } };
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.filtered(), error: null }).then(onfulfilled, onrejected);
  }
}

/** A `.update()/.delete()` chain: `.eq()`/`.in()`/`.is()`/`.lt()` filters, then a terminal call. */
class FakeMutationQuery<TRow extends object> {
  private readonly filters: ((row: TRow) => boolean)[] = [];

  constructor(private readonly apply: (matches: (row: TRow) => boolean) => { data: TRow | null; count: number }) {}

  eq(column: keyof TRow, value: unknown): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: keyof TRow, values: unknown[]): this {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  /** Only `.is(column, null)` is used anywhere in this codebase — that's all this fakes. */
  is(column: keyof TRow, value: null): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  /** A null never matches, like SQL. */
  lt(column: keyof TRow, value: unknown): this {
    this.filters.push((row) => row[column] !== null && compareValues(row[column], value) < 0);
    return this;
  }

  private run() {
    return this.apply((row) => this.filters.every((matches) => matches(row)));
  }

  select() {
    return {
      maybeSingle: async (): Promise<QueryResult> => ({ data: this.run().data, error: null }),
      single: async (): Promise<QueryResult> => {
        const { data } = this.run();
        return data ? { data, error: null } : { data: null, error: { message: 'no rows found' } };
      },
    };
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult & { count: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const { data, count } = this.run();
    return Promise.resolve({ data, count, error: null }).then(onfulfilled, onrejected);
  }
}

/**
 * Stands in for `SupabaseService` in e2e tests, the way `FakeMailService`
 * stands in for real SMTP in the mongodb variant's tests. There is no
 * in-memory Supabase/Postgres equivalent to `mongodb-memory-server`, so this
 * is a hand-rolled double implementing just enough of the supabase-js surface
 * this template's own code calls: `auth.getUser(token)`, the
 * `.from('profiles').select/update/eq/limit/maybeSingle` chain used by
 * `UsersService` and the readiness check, and the
 * `.from('coiffeur_applications')` chain (select/upsert/update/eq/order/
 * range/maybeSingle/single) used by `CoiffeurApplicationsService`.
 *
 * This is NOT a substitute for testing against a real Supabase project — it
 * doesn't enforce RLS, the unique-username constraint's exact Postgres error
 * shape (beyond the one `23505` case it fakes deliberately), or the
 * `handle_new_user()` trigger from schema.sql. See server/README.md.
 *
 * Deliberately does NOT `implements Pick<SupabaseService, 'client'>` — that
 * would require `client` to structurally match the real, huge
 * `SupabaseClient` type. It's handed to `overrideProvider(SupabaseService)`
 * as a plain duck-typed stand-in instead (see app-harness.ts).
 */
export class FakeSupabaseService {
  private readonly authUsersByToken = new Map<string, FakeAuthUser>();
  private readonly profiles = new Map<string, ProfileRow>();
  private readonly coiffeurApplications = new Map<string, CoiffeurApplicationRow>();
  private readonly salonProfiles = new Map<string, SalonProfileRow>();
  private readonly availability = new Map<string, AvailabilityRow>();
  private readonly services = new Map<string, ServiceRow>();
  private readonly galleryPhotos = new Map<string, GalleryPhotoRow>();
  private readonly timeOff = new Map<string, TimeOffRow>();
  private readonly appointments = new Map<string, AppointmentRow>();
  private readonly appointmentServices = new Map<string, AppointmentServiceRow>();
  private nextAppointmentInsertError: string | null = null;
  private beforeAppointmentUpdate: (() => void) | null = null;
  private readonly reviews = new Map<string, ReviewRow>();
  private readonly pushTokens = new Map<string, PushTokenRow>();
  private readonly notificationPreferences = new Map<string, NotificationPreferencesRow>();
  private readonly notificationsLog = new Map<string, NotificationLogRow>();
  private readonly adSlots = new Map<string, AdSlotRow>(defaultAdSlots());
  private readonly appContent = new Map<string, AppContentRow>(defaultAppContent());
  private readonly subscriptions = new Map<string, SubscriptionRow>();
  private platformSettings: PlatformSettingsRow = defaultPlatformSettings();
  private readonly payoutAccounts = new Map<string, PayoutAccountRow>();
  private readonly payments = new Map<string, PaymentRow>();
  private readonly favorites = new Map<string, FavoriteRow>();
  private readonly reviewReports: ReviewReportRow[] = [];
  private lastFavoriteAt = 0;

  readonly client = {
    auth: {
      getUser: async (token: string) => {
        const user = this.authUsersByToken.get(token);
        if (!user) {
          return { data: { user: null }, error: { message: 'invalid token' } };
        }
        return { data: { user }, error: null };
      },
      admin: {
        /** Only used by CoiffeurApplicationNotificationsListener to resolve an email for a decision email. */
        getUserById: async (id: string) => {
          const user = [...this.authUsersByToken.values()].find((candidate) => candidate.id === id);
          if (!user) {
            return { data: { user: null }, error: { message: 'user not found' } };
          }
          return { data: { user }, error: null };
        },
        /** Only used by AdminAccountsService to resolve emails for the accounts list — one page is always enough at test scale. */
        listUsers: async () => ({
          data: { users: [...this.authUsersByToken.values()] },
          error: null,
        }),
        /** Used by AdminUsersService.create() — mirrors handle_new_user(), seeding a blank profile row just like a real signup would. */
        createUser: async (params: { email: string; password: string; email_confirm?: boolean }) => {
          const id = randomUUID();
          const user: FakeAuthUser = {
            id,
            email: params.email,
            email_confirmed_at: params.email_confirm ? new Date().toISOString() : null,
          };
          this.authUsersByToken.set(`created:${id}`, user);
          if (!this.profiles.has(id)) {
            this.profiles.set(id, {
              id,
              first_name: '',
              last_name: '',
              photo_url: null,
              role: 'particulier',
              account_status: 'active',
            });
          }
          return { data: { user }, error: null };
        },
        /** Used by AdminUsersService.remove() — mirrors the real cascade from auth.users to profiles. */
        deleteUser: async (id: string) => {
          const tokenEntry = [...this.authUsersByToken.entries()].find(
            ([, user]) => user.id === id,
          );
          if (tokenEntry) {
            this.authUsersByToken.delete(tokenEntry[0]);
          }
          this.profiles.delete(id);
          return { data: {}, error: null };
        },
      },
    },
    from: (table: string) => {
      if (table === 'profiles') {
        return this.profilesTable();
      }
      if (table === 'coiffeur_applications') {
        return this.coiffeurApplicationsTable();
      }
      if (table === 'coiffeur_profiles') {
        return this.salonProfilesTable();
      }
      if (table === 'coiffeur_availability') {
        return this.availabilityTable();
      }
      if (table === 'coiffeur_services') {
        return this.servicesTable();
      }
      if (table === 'coiffeur_gallery_photos') {
        return this.galleryPhotosTable();
      }
      if (table === 'coiffeur_time_off') {
        return this.timeOffTable();
      }
      if (table === 'appointments') {
        return this.appointmentsTable();
      }
      if (table === 'appointment_services') {
        return this.appointmentServicesTable();
      }
      if (table === 'reviews') {
        return this.reviewsTable();
      }
      if (table === 'push_tokens') {
        return this.pushTokensTable();
      }
      if (table === 'notification_preferences') {
        return this.notificationPreferencesTable();
      }
      if (table === 'notifications_log') {
        return this.notificationsLogTable();
      }
      if (table === 'ad_slots') {
        return this.adSlotsTable();
      }
      if (table === 'app_content') {
        return this.appContentTable();
      }
      if (table === 'coiffeur_subscriptions') {
        return this.subscriptionsTable();
      }
      if (table === 'platform_settings') {
        return this.platformSettingsTable();
      }
      if (table === 'coiffeur_payout_accounts') {
        return this.payoutAccountsTable();
      }
      if (table === 'payments') {
        return this.paymentsTable();
      }
      if (table === 'favorites') {
        return this.favoritesTable();
      }
      if (table === 'review_reports') {
        return this.reviewReportsTable();
      }
      throw new Error(`FakeSupabaseService: unsupported table "${table}"`);
    },
    rpc: async (fn: string, params: Record<string, unknown> = {}) => {
      if (fn === 'search_salons') {
        return this.searchSalonsRpc(params);
      }
      if (fn === 'payouts_due') {
        return this.payoutsDueRpc(params);
      }
      if (fn === 'refunds_owed') {
        return this.refundsOwedRpc(params);
      }
      throw new Error(`FakeSupabaseService: unsupported rpc "${fn}"`);
    },
    storage: {
      /** Only the one bucket/call any code under test actually uses so far. */
      from: (bucket: string) => ({
        createSignedUrls: async (paths: string[], expiresIn: number) => ({
          data: paths.map((path) => ({
            path,
            signedUrl: `https://fake.local/${bucket}/${path}?expiresIn=${expiresIn}`,
          })),
          error: null,
        }),
      }),
    },
  };

  /** Registers a token as belonging to a signed-up-and-verified user, and seeds their profile row (empty unless `profile` is given) — mirroring `handle_new_user()`. */
  addUser(
    token: string,
    user: FakeAuthUser,
    role: string = 'particulier',
    profile?: { firstName: string; lastName: string },
  ): void {
    this.authUsersByToken.set(token, user);
    if (!this.profiles.has(user.id)) {
      this.profiles.set(user.id, {
        id: user.id,
        first_name: profile?.firstName ?? '',
        last_name: profile?.lastName ?? '',
        photo_url: null,
        role,
        account_status: 'active',
      });
    }
  }

  reset(): void {
    this.authUsersByToken.clear();
    this.profiles.clear();
    this.coiffeurApplications.clear();
    this.salonProfiles.clear();
    this.availability.clear();
    this.services.clear();
    this.galleryPhotos.clear();
    this.timeOff.clear();
    this.appointments.clear();
    this.appointmentServices.clear();
    this.nextAppointmentInsertError = null;
    this.beforeAppointmentUpdate = null;
    this.reviews.clear();
    this.pushTokens.clear();
    this.notificationPreferences.clear();
    this.notificationsLog.clear();
    this.adSlots.clear();
    for (const [id, row] of defaultAdSlots()) this.adSlots.set(id, row);
    this.appContent.clear();
    for (const [key, row] of defaultAppContent()) this.appContent.set(key, row);
    this.subscriptions.clear();
    this.platformSettings = defaultPlatformSettings();
    this.payoutAccounts.clear();
    this.payments.clear();
    this.favorites.clear();
    this.reviewReports.length = 0;
  }

  /** Test convenience: a report already on file, as if filed earlier. */
  seedReviewReport(params: { reviewId: string; reporterId: string; reason: string }): void {
    this.reviewReports.push({
      review_id: params.reviewId,
      reporter_id: params.reporterId,
      reason: params.reason,
      details: null,
      created_at: new Date().toISOString(),
    });
  }

  /** Test convenience: a review's reports, in the order they came. */
  reportsOf(reviewId: string): ReviewReportRow[] {
    return this.reviewReports.filter((report) => report.review_id === reviewId);
  }

  /** Test convenience: a client's favorites, for assertions. */
  favoritesOf(particulierId: string): string[] {
    return [...this.favorites.values()].filter((row) => row.particulier_id === particulierId).map((row) => row.coiffeur_id);
  }

  /**
   * Test convenience for reviews.service.spec.ts: seeds an appointment row
   * directly, bypassing AppointmentsService's own create/decide flow — lets
   * a test construct a "done" (confirmed + past `startsAt`) appointment
   * without waiting for real time to pass.
   */
  seedAppointment(params: {
    id?: string;
    particulierId: string;
    coiffeurId: string;
    serviceId?: string | null;
    serviceName?: string;
    price?: number;
    durationMin?: number;
    startsAt: string;
    status?: string;
    attendance?: string | null;
    createdAt?: string;
  }): string {
    const id = params.id ?? randomUUID();
    this.appointments.set(id, {
      id,
      particulier_id: params.particulierId,
      coiffeur_id: params.coiffeurId,
      service_id: params.serviceId ?? null,
      service_name: params.serviceName ?? 'Coupe',
      price: params.price ?? 40,
      duration_min: params.durationMin ?? 45,
      starts_at: params.startsAt,
      status: params.status ?? 'confirmed',
      client_note: null,
      attendance: params.attendance ?? null,
      cancellation_notice_minutes: null,
      moved_by_salon: false,
      created_at: params.createdAt ?? new Date().toISOString(),
    });
    return id;
  }

  /**
   * Test convenience: the next `appointments` insert fails with this Postgres
   * error code — e.g. '23P01', the exclusion constraint a simultaneous
   * booking trips after both requests passed the service's own overlap check.
   */
  failNextAppointmentInsert(code: string): void {
    this.nextAppointmentInsertError = code;
  }

  /** Test convenience: runs once, just before the next `appointments` update lands — another request's change getting there first. */
  beforeNextAppointmentUpdate(run: () => void): void {
    this.beforeAppointmentUpdate = run;
  }

  /** Test convenience: an appointment's status changed behind the service's back (another request, a job). */
  setAppointmentStatus(id: string, status: string): void {
    const existing = this.appointments.get(id);
    if (!existing) {
      throw new Error(`FakeSupabaseService: no appointment "${id}"`);
    }
    this.appointments.set(id, { ...existing, status });
  }

  /** Test convenience: seeds a closure directly — e.g. one already over, which addTimeOff() would refuse. */
  seedTimeOff(params: { profileId: string; startsAt: string; endsAt: string; label?: string }): string {
    const id = randomUUID();
    this.timeOff.set(id, {
      id,
      profile_id: params.profileId,
      staff_id: null,
      starts_at: params.startsAt,
      ends_at: params.endsAt,
      label: params.label ?? '',
      created_at: new Date().toISOString(),
    });
    return id;
  }

  /** Test convenience: suspends/bans/reactivates an account the way AdminAccountsService does, without the admin API round-trip. */
  setAccountStatus(profileId: string, status: 'active' | 'suspended' | 'banned'): void {
    const existing = this.profiles.get(profileId);
    if (!existing) {
      throw new Error(`FakeSupabaseService: no profile "${profileId}" to set a status on`);
    }
    this.profiles.set(profileId, { ...existing, account_status: status });
  }

  /** Test convenience: reads back what notifications/ actually recorded for a user, for assertions. */
  notifyLogFor(userId: string): NotificationLogRow[] {
    return [...this.notificationsLog.values()].filter((row) => row.user_id === userId);
  }

  /** Test convenience: seeds or overwrites a `coiffeur_subscriptions` row directly, as Stripe's webhooks would have left it. */
  seedSubscription(params: {
    profileId: string;
    plan?: string;
    status?: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    trialEndsAt?: string | null;
    currentPeriodEnd?: string | null;
    cancelAt?: string | null;
  }): void {
    const existing = this.subscriptions.get(params.profileId);
    const now = new Date().toISOString();
    const pick = <T>(value: T | undefined, fallback: T): T => (value !== undefined ? value : fallback);
    this.subscriptions.set(params.profileId, {
      profile_id: params.profileId,
      plan: params.plan ?? existing?.plan ?? 'monthly',
      status: params.status ?? existing?.status ?? 'none',
      stripe_customer_id: pick(params.stripeCustomerId, existing?.stripe_customer_id ?? null),
      stripe_subscription_id: pick(params.stripeSubscriptionId, existing?.stripe_subscription_id ?? null),
      trial_ends_at: pick(params.trialEndsAt, existing?.trial_ends_at ?? null),
      current_period_end: pick(params.currentPeriodEnd, existing?.current_period_end ?? null),
      cancel_at: pick(params.cancelAt, existing?.cancel_at ?? null),
      created_at: existing?.created_at ?? now,
      updated_at: now,
    });
  }

  /** Test convenience: the platform_settings row as the admin left it. */
  seedPlatformSettings(params: { trialDays?: number; commissionPercent?: number }): void {
    this.platformSettings = {
      ...this.platformSettings,
      ...(params.trialDays !== undefined ? { trial_days: params.trialDays } : {}),
      ...(params.commissionPercent !== undefined ? { commission_percent: params.commissionPercent } : {}),
    };
  }

  /** Test convenience: a salon's Stripe Connect account as Stripe's webhooks would have left it. */
  seedPayoutAccount(params: {
    profileId: string;
    stripeAccountId?: string | null;
    detailsSubmitted?: boolean;
    payoutsEnabled?: boolean;
    bookableWithoutPayouts?: boolean;
  }): void {
    const now = new Date().toISOString();
    const existing = this.payoutAccounts.get(params.profileId);
    this.payoutAccounts.set(params.profileId, {
      profile_id: params.profileId,
      stripe_account_id: params.stripeAccountId !== undefined ? params.stripeAccountId : (existing?.stripe_account_id ?? null),
      details_submitted: params.detailsSubmitted ?? existing?.details_submitted ?? false,
      charges_enabled: params.payoutsEnabled ?? existing?.charges_enabled ?? false,
      payouts_enabled: params.payoutsEnabled ?? existing?.payouts_enabled ?? false,
      bookable_without_payouts: params.bookableWithoutPayouts ?? existing?.bookable_without_payouts ?? false,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    });
  }

  /** Test convenience: reads a salon's payout account back, for assertions. */
  payoutAccountFor(profileId: string): PayoutAccountRow | undefined {
    return this.payoutAccounts.get(profileId);
  }

  /** Test convenience: an appointment's payment row, for assertions. */
  paymentFor(appointmentId: string): PaymentRow | undefined {
    return [...this.payments.values()].find((payment) => payment.appointment_id === appointmentId);
  }

  /** Test convenience: a payment as the app's Checkout would have left it. */
  seedPayment(params: {
    appointmentId: string;
    particulierId: string;
    coiffeurId: string;
    amount: number;
    status?: string;
    paymentIntentId?: string;
    chargeId?: string | null;
    commissionRate?: number;
    /** The rate's share of the amount unless given. */
    commissionAmount?: number;
    refundedAmount?: number;
    transferId?: string | null;
    transferAmount?: number | null;
    /** Set with `transferId` unless given: a transfer is always attempted before it's made. */
    transferAttemptedAt?: string | null;
    reversedAmount?: number;
    lockedUntil?: string | null;
  }): string {
    const id = randomUUID();
    const now = new Date().toISOString();
    const rate = params.commissionRate ?? 10;
    this.payments.set(id, {
      id,
      appointment_id: params.appointmentId,
      particulier_id: params.particulierId,
      coiffeur_id: params.coiffeurId,
      payment_intent_id: params.paymentIntentId ?? `pi_${id}`,
      checkout_session_id: null,
      charge_id: params.chargeId !== undefined ? params.chargeId : `ch_${id}`,
      amount: params.amount,
      currency: 'eur',
      commission_rate: rate,
      commission_amount: params.commissionAmount ?? Math.round(params.amount * rate) / 100,
      status: params.status ?? 'succeeded',
      refunded_amount: params.refundedAmount ?? 0,
      transfer_id: params.transferId ?? null,
      transfer_amount: params.transferAmount ?? null,
      transferred_at: params.transferId ? now : null,
      transfer_attempted_at: params.transferAttemptedAt !== undefined ? params.transferAttemptedAt : params.transferId ? now : null,
      reversed_amount: params.reversedAmount ?? 0,
      locked_until: params.lockedUntil ?? null,
      created_at: now,
      updated_at: now,
    });
    return id;
  }

  /** Test convenience: reads a `coiffeur_subscriptions` row back, for assertions. */
  subscriptionFor(profileId: string): SubscriptionRow | undefined {
    return this.subscriptions.get(profileId);
  }

  /**
   * Test convenience: seeds or updates a `coiffeur_applications` row without
   * going through the real onboarding/admin-review flow. Merges onto
   * whatever already exists for that `profileId`, so a second call (e.g.
   * flipping `status` back to `'pending'` after `seedValidatedSalon`) reads
   * naturally as "and now this changed" rather than a fresh row.
   */
  seedApplication(params: {
    profileId: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    salonName?: string;
    description?: string;
    addressLine?: string | null;
    postalCode?: string | null;
    city?: string | null;
    status?: string;
    shopProfileComplete?: boolean;
    practiceZone?: 'salon' | 'domicile';
    travelRadiusKm?: number | null;
  }): void {
    const existing = this.coiffeurApplications.get(params.profileId);
    this.coiffeurApplications.set(params.profileId, {
      id: existing?.id ?? randomUUID(),
      profile_id: params.profileId,
      first_name: params.firstName ?? existing?.first_name ?? '',
      last_name: params.lastName ?? existing?.last_name ?? '',
      phone: params.phone ?? existing?.phone ?? '',
      salon_name: params.salonName ?? existing?.salon_name ?? '',
      description: params.description ?? existing?.description ?? '',
      practice_zone: params.practiceZone ?? existing?.practice_zone ?? 'salon',
      address_line: params.addressLine !== undefined ? params.addressLine : (existing?.address_line ?? null),
      postal_code: params.postalCode !== undefined ? params.postalCode : (existing?.postal_code ?? null),
      city: params.city !== undefined ? params.city : (existing?.city ?? null),
      invoice_document_path: existing?.invoice_document_path ?? null,
      travel_radius_km: params.travelRadiusKm !== undefined ? params.travelRadiusKm : (existing?.travel_radius_km ?? null),
      identity_document_path: existing?.identity_document_path ?? 'x',
      diploma_document_path: existing?.diploma_document_path ?? 'x',
      kbis_document_path: existing?.kbis_document_path ?? 'x',
      status: params.status ?? existing?.status ?? 'pending',
      review_message: existing?.review_message ?? null,
      shop_profile_complete: params.shopProfileComplete ?? existing?.shop_profile_complete ?? false,
      submitted_at: existing?.submitted_at ?? new Date().toISOString(),
      reviewed_at: existing?.reviewed_at ?? null,
    });
  }

  /**
   * Test convenience for src/discovery/ specs: seeds a validated,
   * shop-complete coiffeur with a salon profile in one call — the shape
   * `search_salons()` reads (a real coiffeur only reaches this state after
   * onboarding + admin approval + filling in their shop profile, which is
   * its own multi-step flow this helper skips past).
   */
  seedValidatedSalon(params: {
    profileId: string;
    firstName: string;
    lastName: string;
    salonName: string;
    tagline?: string;
    description?: string;
    addressLine?: string;
    postalCode?: string;
    city?: string;
    phone?: string;
    latitude?: number | null;
    longitude?: number | null;
    specialties?: string[];
    badges?: string[];
    rating?: number;
    reviewCount?: number;
    coverUrl?: string | null;
    confirmationMode?: 'manual' | 'instant';
    bookingNoticeMinutes?: number;
    cancellationNoticeMinutes?: number;
    practiceZone?: 'salon' | 'domicile';
    travelRadiusKm?: number | null;
    instagramUrl?: string | null;
    services?: { name: string; price: number; durationMin: number; specialty: string; isActive?: boolean }[];
    /** Listed salons need a live subscription (TODO.md Phase 4): by default an offered one, a year long. `false` = never subscribed. */
    subscribed?: boolean;
    /** Bookable salons need Stripe payouts (TODO.md Phase 5): by default a ready Connect account. `false` = none. */
    onlineBooking?: boolean;
  }): void {
    if (params.onlineBooking !== false && !this.payoutAccounts.has(params.profileId)) {
      this.seedPayoutAccount({
        profileId: params.profileId,
        stripeAccountId: `acct_${params.profileId}`,
        detailsSubmitted: true,
        payoutsEnabled: true,
      });
    }
    if (params.subscribed !== false && !this.subscriptions.has(params.profileId)) {
      this.seedSubscription({
        profileId: params.profileId,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 365 * 86_400_000).toISOString(),
      });
    }
    this.seedApplication({
      profileId: params.profileId,
      firstName: params.firstName,
      lastName: params.lastName,
      status: 'validated',
      shopProfileComplete: true,
    });
    // A real coiffeur_profiles row always has its profiles row (FK) — search
    // and booking read its account_status.
    if (!this.profiles.has(params.profileId)) {
      this.profiles.set(params.profileId, {
        id: params.profileId,
        first_name: params.firstName,
        last_name: params.lastName,
        photo_url: null,
        role: 'coiffeur',
        account_status: 'active',
      });
    }
    this.salonProfiles.set(params.profileId, {
      profile_id: params.profileId,
      salon_name: params.salonName,
      tagline: params.tagline ?? '',
      description: params.description ?? '',
      address_line: params.addressLine ?? '',
      postal_code: params.postalCode ?? '',
      city: params.city ?? '',
      phone: params.phone ?? '',
      specialties: params.specialties ?? [],
      cover_url: params.coverUrl ?? null,
      latitude: params.latitude ?? null,
      longitude: params.longitude ?? null,
      rating: params.rating ?? 0,
      review_count: params.reviewCount ?? 0,
      badges: params.badges ?? [],
      // Same defaults as schema.sql's coiffeur_profiles columns.
      confirmation_mode: params.confirmationMode ?? 'manual',
      booking_notice_minutes: params.bookingNoticeMinutes ?? 60,
      cancellation_notice_minutes: params.cancellationNoticeMinutes ?? 1440,
      practice_zone: params.practiceZone ?? 'salon',
      travel_radius_km: params.travelRadiusKm ?? null,
      instagram_url: params.instagramUrl ?? null,
      facebook_url: null,
      tiktok_url: null,
      website_url: null,
    });
    for (const service of params.services ?? []) {
      const id = randomUUID();
      this.services.set(id, {
        id,
        profile_id: params.profileId,
        name: service.name,
        description: null,
        price: service.price,
        duration_min: service.durationMin,
        specialty: service.specialty,
        is_active: service.isActive ?? true,
      });
    }
  }

  /** Mirrors payouts_due() (schema.sql): paid, accepted bookings over by `p_cutoff`, at salons whose payouts are on. */
  private payoutsDueRpc(params: Record<string, unknown>): QueryResult {
    const cutoff = new Date(params.p_cutoff as string).getTime();
    const due = [...this.payments.values()]
      .map((payment) => ({ payment, appointment: this.appointments.get(payment.appointment_id) }))
      .filter(({ payment, appointment }) => {
        const account = this.payoutAccounts.get(payment.coiffeur_id);
        return (
          payment.status === 'succeeded' &&
          payment.transfer_id === null &&
          payment.refunded_amount < payment.amount &&
          appointment?.status === 'confirmed' &&
          new Date(appointment.starts_at).getTime() + appointment.duration_min * 60_000 <= cutoff &&
          Boolean(account?.stripe_account_id && account.payouts_enabled)
        );
      })
      // Never tried first, then the longest waiting: a payout that keeps failing never holds the others up.
      .sort(
        (a, b) =>
          (a.payment.transfer_attempted_at ?? '').localeCompare(b.payment.transfer_attempted_at ?? '') ||
          a.appointment!.starts_at.localeCompare(b.appointment!.starts_at),
      )
      .map(({ payment }) => payment);
    return { data: due.slice(0, params.p_limit as number), error: null };
  }

  /** Mirrors refunds_owed() (schema.sql): paid bookings cancelled or refused, not fully refunded yet. */
  private refundsOwedRpc(params: Record<string, unknown>): QueryResult {
    const owed = [...this.payments.values()].filter((payment) => {
      const status = this.appointments.get(payment.appointment_id)?.status;
      return (
        payment.status === 'succeeded' &&
        payment.transfer_id === null &&
        payment.transfer_attempted_at === null &&
        payment.refunded_amount < payment.amount &&
        (status === 'cancelled' || status === 'refused')
      );
    });
    return { data: owed.slice(0, params.p_limit as number), error: null };
  }

  /** Mirrors search_salons() (schema.sql): visibility, every filter, the sorts and a stable order for pages. */
  private searchSalonsRpc(params: Record<string, unknown>): QueryResult {
    const param = <T>(key: string): T | null => (params[key] ?? null) as T | null;
    const lat = param<number>('p_lat');
    const lng = param<number>('p_lng');
    const radiusKm = param<number>('p_radius_km');
    const specialties = param<string[]>('p_specialties');
    const city = param<string>('p_city');
    const query = param<string>('p_query');
    const priceMin = param<number>('p_price_min');
    const priceMax = param<number>('p_price_max');
    const openNow = params.p_open_now === true;
    const openOn = param<string>('p_open_on');
    const openAfter = param<number>('p_open_after');
    const practiceZone = param<string>('p_practice_zone');
    const bounds = param<number[]>('p_bounds');
    const ids = param<string[]>('p_ids');
    const sort = param<string>('p_sort') ?? 'distance';
    const now = new Date(param<string>('p_now') ?? Date.now());
    const limit = (params.p_limit as number | undefined) ?? 20;
    const offset = (params.p_offset as number | undefined) ?? 0;
    const origin = lat != null && lng != null ? { lat, lng } : null;

    // Like unaccent: accents off, and the œ/æ ligatures spelt out.
    const normalize = (text: string) =>
      text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/œ/g, 'oe')
        .replace(/Œ/g, 'OE')
        .replace(/æ/g, 'ae')
        .replace(/Æ/g, 'AE')
        .toLowerCase();
    const activeServices = (profileId: string) =>
      [...this.services.values()].filter((service) => service.profile_id === profileId && service.is_active);
    // Each salon's week: its own hours, or the default a new salon starts with.
    const weekOf = (profileId: string) => {
      const own = [...this.availability.values()].filter((day) => day.profile_id === profileId);
      if (own.length > 0) return own;
      return [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        profile_id: profileId,
        weekday,
        is_open: weekday !== 0,
        opens_minute: 540,
        closes_minute: 1140,
        break_start_minute: weekday === 0 ? null : 780,
        break_end_minute: weekday === 0 ? null : 840,
      }));
    };
    const closuresOf = (profileId: string) => [...this.timeOff.values()].filter((closure) => closure.profile_id === profileId);
    const isOpenNow = (profileId: string) => {
      const paris = parisParts(now);
      const minute = paris.hour * 60 + paris.minute;
      const inHours = weekOf(profileId).some(
        (day) =>
          day.is_open &&
          day.weekday === paris.weekday &&
          minute >= day.opens_minute &&
          minute < day.closes_minute &&
          !(day.break_start_minute != null && minute >= day.break_start_minute && minute < (day.break_end_minute ?? 0)),
      );
      const closed = closuresOf(profileId).some(
        (closure) => new Date(closure.starts_at) <= now && new Date(closure.ends_at) > now,
      );
      return inHours && !closed;
    };
    const isOpenOn = (profileId: string, date: string) => {
      const [year, month, dayOfMonth] = date.split('-').map(Number);
      const weekday = new Date(Date.UTC(year, month - 1, dayOfMonth)).getUTCDay();
      return weekOf(profileId).some((day) => {
        if (!day.is_open || day.weekday !== weekday) return false;
        if (openAfter != null && day.closes_minute <= openAfter) return false;
        const from = parisTime(year, month, dayOfMonth, 0, Math.max(day.opens_minute, openAfter ?? 0));
        const to = parisTime(year, month, dayOfMonth, 0, day.closes_minute);
        return !closuresOf(profileId).some((closure) => new Date(closure.starts_at) <= from && new Date(closure.ends_at) >= to);
      });
    };

    const rows = [...this.salonProfiles.values()]
      .map((profile) => ({
        profile,
        application: [...this.coiffeurApplications.values()].find((app) => app.profile_id === profile.profile_id),
      }))
      .filter(({ application }) => application?.status === 'validated' && application?.shop_profile_complete === true)
      // Mirrors search_salons()'s join on profiles.account_status = 'active'.
      .filter(({ profile }) => this.profiles.get(profile.profile_id)?.account_status === 'active')
      // ...and its join on a live subscription.
      .filter(({ profile }) => isListedSubscription(this.subscriptions.get(profile.profile_id)))
      .filter(({ profile }) => ids == null || ids.includes(profile.profile_id))
      .filter(({ profile }) => specialties == null || specialties.length === 0 || profile.specialties.some((s) => specialties.includes(s)))
      .filter(({ profile }) => city == null || profile.city.toLowerCase() === city.toLowerCase())
      .filter(({ profile }) => practiceZone == null || profile.practice_zone === practiceZone)
      .filter(({ profile, application }) => {
        const words = normalize(query?.trim() ?? '').split(/\s+/).filter(Boolean);
        const haystack = normalize(
          [
            profile.salon_name,
            application?.first_name,
            application?.last_name,
            profile.tagline,
            profile.city,
            profile.postal_code,
            profile.address_line,
            ...activeServices(profile.profile_id).map((service) => service.name),
          ].join(' '),
        );
        return words.every((word) => haystack.includes(word));
      })
      .filter(
        ({ profile }) =>
          (priceMin == null && priceMax == null) ||
          activeServices(profile.profile_id).some(
            (service) => (priceMin == null || service.price >= priceMin) && (priceMax == null || service.price <= priceMax),
          ),
      )
      .filter(({ profile }) => !openNow || isOpenNow(profile.profile_id))
      .filter(({ profile }) => openOn == null || isOpenOn(profile.profile_id, openOn))
      .filter(
        ({ profile }) =>
          openAfter == null ||
          openOn != null ||
          weekOf(profile.profile_id).some((day) => day.is_open && day.closes_minute > openAfter),
      )
      .filter(
        ({ profile }) =>
          bounds == null ||
          (profile.latitude != null &&
            profile.longitude != null &&
            profile.latitude >= bounds[0] &&
            profile.latitude <= bounds[2] &&
            profile.longitude >= bounds[1] &&
            profile.longitude <= bounds[3]),
      )
      .map(({ profile, application }) => {
        const distanceKm =
          origin && profile.latitude != null && profile.longitude != null
            ? haversineKm(origin, { lat: profile.latitude, lng: profile.longitude })
            : null;
        const services = activeServices(profile.profile_id);
        const account = this.payoutAccounts.get(profile.profile_id);
        return {
          profile_id: profile.profile_id,
          salon_name: profile.salon_name,
          stylist_first_name: application?.first_name ?? '',
          stylist_last_name: application?.last_name ?? '',
          tagline: profile.tagline,
          description: profile.description,
          address_line: profile.address_line,
          postal_code: profile.postal_code,
          city: profile.city,
          latitude: profile.latitude,
          longitude: profile.longitude,
          phone: profile.phone,
          specialties: profile.specialties,
          badges: profile.badges,
          rating: profile.rating,
          review_count: profile.review_count,
          cover_url: profile.cover_url,
          price_from: services.length > 0 ? Math.min(...services.map((s) => Number(s.price))) : null,
          shortest_duration_min: services.length > 0 ? Math.min(...services.map((s) => s.duration_min)) : null,
          practice_zone: profile.practice_zone,
          travel_radius_km: profile.travel_radius_km,
          booking_notice_minutes: profile.booking_notice_minutes,
          online_booking: Boolean((account?.stripe_account_id && account.payouts_enabled) || account?.bookable_without_payouts),
          distance_km: distanceKm,
        };
      })
      // A salon with no known location is excluded from a radius search, not
      // passed through by virtue of "we can't check" — mirrors search_salons().
      // A home-service coiffeur comes to the client: their own radius decides.
      .filter(
        (row) =>
          radiusKm == null ||
          origin == null ||
          row.practice_zone === 'domicile' ||
          (row.distance_km != null && row.distance_km <= radiusKm),
      )
      // A home-service coiffeur only shows to clients they'd travel to — except by name (favorites).
      .filter(
        (row) =>
          ids != null ||
          row.practice_zone !== 'domicile' ||
          row.travel_radius_km == null ||
          row.distance_km == null ||
          row.distance_km <= row.travel_radius_km,
      )
      .sort((a, b) => {
        const nullsLast = (x: number | null, y: number | null, direction: 1 | -1) =>
          x === y ? 0 : x == null ? 1 : y == null ? -1 : (x - y) * direction;
        return (
          (sort === 'price' ? nullsLast(a.price_from, b.price_from, 1) : 0) ||
          (sort === 'rating' ? nullsLast(a.rating, b.rating, -1) || b.review_count - a.review_count : 0) ||
          nullsLast(a.distance_km, b.distance_km, 1) ||
          b.rating - a.rating ||
          (a.profile_id < b.profile_id ? -1 : a.profile_id > b.profile_id ? 1 : 0)
        );
      });

    const totalCount = rows.length;
    const page = rows.slice(offset, offset + limit).map((row) => ({ ...row, total_count: totalCount }));
    return { data: page, error: null };
  }

  private profilesTable() {
    const profiles = this.profiles;

    return {
      select: () => new FakeSelectQuery<ProfileRow>(() => [...profiles.values()]),
      update: (patch: Partial<ProfileRow>) => ({
        eq: (_column: 'id', id: string) => ({
          select: () => ({
            maybeSingle: async (): Promise<QueryResult> => {
              const existing = profiles.get(id);
              if (!existing) {
                return { data: null, error: null };
              }
              const updated = { ...existing, ...patch };
              profiles.set(id, updated);
              return { data: updated, error: null };
            },
          }),
        }),
      }),
    };
  }

  private coiffeurApplicationsTable() {
    const apps = this.coiffeurApplications;

    return {
      select: () => new FakeSelectQuery<CoiffeurApplicationRow>(() => [...apps.values()]),

      /**
       * Insert-or-replace-in-place keyed on `onConflict`, mirroring the
       * unique `profile_id` constraint. Columns the real schema defaults
       * (and that `CoiffeurApplicationsService` deliberately omits from its
       * upsert payload so a resubmission doesn't reset them) only get that
       * default on a fresh insert, same as Postgres would.
       */
      upsert: (row: Record<string, unknown>, options: { onConflict: string }) => ({
        select: () => ({
          single: async (): Promise<QueryResult> => {
            const conflictColumn = options.onConflict as keyof CoiffeurApplicationRow;
            const existing = [...apps.values()].find((r) => r[conflictColumn] === row[conflictColumn]);
            // A real uuid column: ParseUUIDPipe on the admin decide route
            // expects one, so a fake id has to look like one too.
            const id = existing?.id ?? randomUUID();
            const defaults = existing ? {} : { shop_profile_complete: false };
            const merged = { ...defaults, ...existing, ...row, id } as CoiffeurApplicationRow;
            apps.set(id, merged);
            return { data: merged, error: null };
          },
        }),
      }),

      update: (patch: Partial<CoiffeurApplicationRow>) => ({
        eq: (column: keyof CoiffeurApplicationRow, value: unknown) => {
          const apply = (): CoiffeurApplicationRow | null => {
            const existing = [...apps.values()].find((row) => row[column] === value);
            if (!existing) {
              return null;
            }
            const updated = { ...existing, ...patch };
            apps.set(existing.id, updated);
            return updated;
          };
          return {
            select: () => ({
              maybeSingle: async (): Promise<QueryResult> => ({ data: apply(), error: null }),
              single: async (): Promise<QueryResult> => {
                const updated = apply();
                return updated ? { data: updated, error: null } : { data: null, error: { message: 'no rows found' } };
              },
            }),
          };
        },
      }),
    };
  }

  private salonProfilesTable() {
    const rows = this.salonProfiles;

    return {
      select: () => new FakeSelectQuery<SalonProfileRow>(() => [...rows.values()]),

      /**
       * Supports both call shapes real code uses: chained with
       * `.select().single()` (updateProfile) and awaited bare
       * (seedProfileFromApplication) — the latter also passes
       * `ignoreDuplicates`, which here is a true no-op against an existing
       * row, same as PostgREST's `resolution=ignore-duplicates`: no row
       * comes back, `.single()` would 404 on it, so it must never be
       * chained by a caller that skipped.
       */
      upsert: (
        row: Record<string, unknown>,
        options?: { onConflict?: string; ignoreDuplicates?: boolean },
      ) => {
        const profileId = row.profile_id as string;
        const existing = rows.get(profileId);
        const skip = Boolean(options?.ignoreDuplicates && existing);
        // Mirrors real Postgres column defaults on a fresh insert — SalonService's
        // own patch never sets these (rating/review_count/badges are seed/system-only).
        const defaults = existing
          ? {}
          : {
              latitude: null,
              longitude: null,
              rating: 0,
              review_count: 0,
              badges: [],
              confirmation_mode: 'manual',
              booking_notice_minutes: 60,
              cancellation_notice_minutes: 1440,
              practice_zone: 'salon',
              travel_radius_km: null,
              instagram_url: null,
              facebook_url: null,
              tiktok_url: null,
              website_url: null,
            };
        const merged = skip ? (existing as SalonProfileRow) : ({ ...defaults, ...existing, ...row } as SalonProfileRow);
        if (!skip) rows.set(profileId, merged);

        return {
          select: () => ({
            single: async (): Promise<QueryResult> =>
              skip ? { data: null, error: { message: 'no rows found' } } : { data: merged, error: null },
          }),
          then<TResult1 = QueryResult, TResult2 = never>(
            onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
            onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
          ): PromiseLike<TResult1 | TResult2> {
            return Promise.resolve({ data: skip ? null : merged, error: null }).then(onfulfilled, onrejected);
          },
        };
      },
    };
  }

  private availabilityTable() {
    const rows = this.availability;

    return {
      select: () => new FakeSelectQuery<AvailabilityRow>(() => [...rows.values()]),

      /** Bulk upsert — SalonService.replaceAvailability always writes all 7 weekdays at once. */
      upsert: (input: Record<string, unknown>[]) => {
        const profileIds = new Set<string>();
        for (const row of input) {
          const key = `${row.profile_id as string}:${row.weekday as number}`;
          rows.set(key, { ...rows.get(key), ...row } as AvailabilityRow);
          profileIds.add(row.profile_id as string);
        }
        return {
          select: () =>
            new FakeSelectQuery<AvailabilityRow>(() =>
              [...rows.values()].filter((row) => profileIds.has(row.profile_id)),
            ),
        };
      },
    };
  }

  private servicesTable() {
    const rows = this.services;

    return {
      select: () => new FakeSelectQuery<ServiceRow>(() => [...rows.values()]),

      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async (): Promise<QueryResult> => {
            const id = randomUUID();
            const created = { is_active: true, ...row, id } as ServiceRow;
            rows.set(id, created);
            return { data: created, error: null };
          },
        }),
      }),

      update: (patch: Record<string, unknown>) =>
        new FakeMutationQuery<ServiceRow>((matches) => {
          const existing = [...rows.values()].find(matches);
          if (!existing) {
            return { data: null, count: 0 };
          }
          const updated = { ...existing, ...patch };
          rows.set(existing.id, updated);
          return { data: updated, count: 1 };
        }),

      delete: () =>
        new FakeMutationQuery<ServiceRow>((matches) => {
          const existing = [...rows.values()].find(matches);
          if (!existing) {
            return { data: null, count: 0 };
          }
          rows.delete(existing.id);
          return { data: existing, count: 1 };
        }),
    };
  }

  private galleryPhotosTable() {
    const rows = this.galleryPhotos;

    return {
      select: () => new FakeSelectQuery<GalleryPhotoRow>(() => [...rows.values()]),

      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async (): Promise<QueryResult> => {
            const id = randomUUID();
            const created = { ...row, id, created_at: new Date().toISOString() } as GalleryPhotoRow;
            rows.set(id, created);
            return { data: created, error: null };
          },
        }),
      }),

      delete: () =>
        new FakeMutationQuery<GalleryPhotoRow>((matches) => {
          const existing = [...rows.values()].find(matches);
          if (!existing) {
            return { data: null, count: 0 };
          }
          rows.delete(existing.id);
          return { data: existing, count: 1 };
        }),
    };
  }

  private timeOffTable() {
    const rows = this.timeOff;

    return {
      select: () => new FakeSelectQuery<TimeOffRow>(() => [...rows.values()]),

      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async (): Promise<QueryResult> => {
            const id = randomUUID();
            const created = {
              staff_id: null,
              label: '',
              ...row,
              id,
              created_at: new Date().toISOString(),
            } as TimeOffRow;
            rows.set(id, created);
            return { data: created, error: null };
          },
        }),
      }),

      delete: () =>
        new FakeMutationQuery<TimeOffRow>((matches) => {
          const existing = [...rows.values()].find(matches);
          if (!existing) {
            return { data: null, count: 0 };
          }
          rows.delete(existing.id);
          return { data: existing, count: 1 };
        }),
    };
  }

  private appointmentsTable() {
    const rows = this.appointments;
    // What `select('*, appointment_services(*)')` embeds for real — always attached here, harmless when not asked for.
    const withLines = (row: AppointmentRow) => ({
      ...row,
      // One-to-one (payments.appointment_id is unique): PostgREST embeds an object, not a list.
      payments: [...this.payments.values()].find((payment) => payment.appointment_id === row.id) ?? null,
      appointment_services: [...this.appointmentServices.values()].filter((line) => line.appointment_id === row.id),
    });

    return {
      select: () => new FakeSelectQuery<AppointmentRow>(() => [...rows.values()].map(withLines)),

      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async (): Promise<QueryResult> => {
            if (this.nextAppointmentInsertError) {
              const code = this.nextAppointmentInsertError;
              this.nextAppointmentInsertError = null;
              return { data: null, error: { code, message: 'conflicting key value violates exclusion constraint' } };
            }
            const id = randomUUID();
            const created = {
              attendance: null,
              cancellation_notice_minutes: null,
              moved_by_salon: false,
              ...row,
              id,
              created_at: new Date().toISOString(),
            } as AppointmentRow;
            rows.set(id, created);
            return { data: created, error: null };
          },
        }),
      }),

      update: (patch: Record<string, unknown>) =>
        new FakeMutationQuery<AppointmentRow>((matches) => {
          const before = this.beforeAppointmentUpdate;
          this.beforeAppointmentUpdate = null;
          before?.();
          const existing = [...rows.values()].find(matches);
          if (!existing) {
            return { data: null, count: 0 };
          }
          const updated = { ...existing, ...patch };
          rows.set(existing.id, updated);
          return { data: withLines(updated), count: 1 };
        }),

      /** Mirrors the real ON DELETE CASCADE to appointment_services. */
      delete: () =>
        new FakeMutationQuery<AppointmentRow>((matches) => {
          const existing = [...rows.values()].find(matches);
          if (!existing) {
            return { data: null, count: 0 };
          }
          rows.delete(existing.id);
          for (const [lineId, line] of this.appointmentServices) {
            if (line.appointment_id === existing.id) this.appointmentServices.delete(lineId);
          }
          for (const [paymentId, payment] of this.payments) {
            if (payment.appointment_id === existing.id) this.payments.delete(paymentId);
          }
          return { data: existing, count: 1 };
        }),
    };
  }

  private appointmentServicesTable() {
    const rows = this.appointmentServices;

    return {
      select: () => new FakeSelectQuery<AppointmentServiceRow>(() => [...rows.values()]),

      /** Bulk insert, awaited bare — AppointmentsService never reads the lines back from this call. */
      insert: (input: Record<string, unknown>[]) => {
        for (const row of input) {
          const id = randomUUID();
          rows.set(id, { ...row, id } as AppointmentServiceRow);
        }
        return Promise.resolve({ data: null, error: null });
      },
    };
  }

  private reviewsTable() {
    const rows = this.reviews;

    return {
      select: () => new FakeSelectQuery<ReviewRow>(() => [...rows.values()]),

      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async (): Promise<QueryResult> => {
            const id = randomUUID();
            const created = {
              status: 'visible',
              coiffeur_reply: null,
              replied_at: null,
              report_reason: null,
              reported_at: null,
              ...row,
              id,
              created_at: new Date().toISOString(),
            } as ReviewRow;
            rows.set(id, created);
            return { data: created, error: null };
          },
        }),
      }),

      update: (patch: Record<string, unknown>) =>
        new FakeMutationQuery<ReviewRow>((matches) => {
          const existing = [...rows.values()].find(matches);
          if (!existing) {
            return { data: null, count: 0 };
          }
          const updated = { ...existing, ...patch };
          rows.set(existing.id, updated);
          return { data: updated, count: 1 };
        }),
    };
  }

  private pushTokensTable() {
    const rows = this.pushTokens;

    return {
      select: () => new FakeSelectQuery<PushTokenRow>(() => [...rows.values()]),

      /** No `.select()` is ever chained after this in real code — resolves directly, like the real client does when nothing reads the result. */
      upsert: (row: Record<string, unknown>, options: { onConflict: string }) => {
        const conflictColumn = options.onConflict as keyof PushTokenRow;
        const existing = [...rows.values()].find((r) => r[conflictColumn] === row[conflictColumn]);
        const id = existing?.id ?? randomUUID();
        const merged = {
          ...existing,
          ...row,
          id,
          created_at: existing?.created_at ?? new Date().toISOString(),
        } as PushTokenRow;
        rows.set(id, merged);
        return Promise.resolve({ data: merged, error: null });
      },

      update: (patch: Record<string, unknown>) =>
        new FakeMutationQuery<PushTokenRow>((matches) => {
          const existing = [...rows.values()].find(matches);
          if (!existing) {
            return { data: null, count: 0 };
          }
          const updated = { ...existing, ...patch };
          rows.set(existing.id, updated);
          return { data: updated, count: 1 };
        }),

      delete: () =>
        new FakeMutationQuery<PushTokenRow>((matches) => {
          const existing = [...rows.values()].find(matches);
          if (!existing) {
            return { data: null, count: 0 };
          }
          rows.delete(existing.id);
          return { data: existing, count: 1 };
        }),
    };
  }

  private notificationPreferencesTable() {
    const rows = this.notificationPreferences;

    return {
      select: () => new FakeSelectQuery<NotificationPreferencesRow>(() => [...rows.values()]),

      upsert: (row: Record<string, unknown>) => {
        const userId = row.user_id as string;
        const merged = {
          reminder_day_before: true,
          reminder_hour_before: true,
          ...rows.get(userId),
          ...row,
          updated_at: new Date().toISOString(),
        } as NotificationPreferencesRow;
        rows.set(userId, merged);
        return {
          select: () => ({
            single: async (): Promise<QueryResult> => ({ data: merged, error: null }),
          }),
        };
      },
    };
  }

  private notificationsLogTable() {
    const rows = this.notificationsLog;

    return {
      select: () => new FakeSelectQuery<NotificationLogRow>(() => [...rows.values()]),

      /** Emulates the real unique index on (user_id, type, dedupe_key) — the actual duplicate guard, per notifications_log's schema comment. */
      insert: (row: Record<string, unknown>) => {
        const duplicate = [...rows.values()].some(
          (existing) =>
            existing.user_id === row.user_id &&
            existing.type === row.type &&
            existing.dedupe_key === row.dedupe_key,
        );
        if (duplicate) {
          return Promise.resolve({
            data: null,
            error: { code: '23505', message: 'duplicate key value violates unique constraint' },
          });
        }
        const id = randomUUID();
        const created = { ...row, id, created_at: new Date().toISOString() } as NotificationLogRow;
        rows.set(id, created);
        return Promise.resolve({ data: created, error: null });
      },
    };
  }

  private subscriptionsTable() {
    const rows = this.subscriptions;

    return {
      select: () => new FakeSelectQuery<SubscriptionRow>(() => [...rows.values()]),

      /** `onConflict: 'profile_id'`, merging like PostgREST: columns left out keep their value, a new row gets the schema defaults. */
      upsert: async (row: Record<string, unknown>): Promise<QueryResult> => {
        const now = new Date().toISOString();
        const profileId = row.profile_id as string;
        const existing = rows.get(profileId);
        const merged = {
          plan: 'monthly',
          status: 'none',
          stripe_customer_id: null,
          stripe_subscription_id: null,
          trial_ends_at: null,
          current_period_end: null,
          cancel_at: null,
          created_at: now,
          ...existing,
          ...row,
          updated_at: now,
        } as SubscriptionRow;
        rows.set(profileId, merged);
        return { data: null, error: null };
      },

      update: (patch: Record<string, unknown>) =>
        new FakeMutationQuery<SubscriptionRow>((matches) => {
          const existing = [...rows.values()].find(matches);
          if (!existing) {
            return { data: null, count: 0 };
          }
          const updated = { ...existing, ...patch, updated_at: new Date().toISOString() };
          rows.set(existing.profile_id, updated);
          return { data: updated, count: 1 };
        }),
    };
  }

  private payoutAccountsTable() {
    const rows = this.payoutAccounts;

    return {
      select: () => new FakeSelectQuery<PayoutAccountRow>(() => [...rows.values()]),

      /** `onConflict: 'profile_id'`, merging like PostgREST. */
      upsert: async (row: Record<string, unknown>): Promise<QueryResult> => {
        const now = new Date().toISOString();
        const profileId = row.profile_id as string;
        const existing = rows.get(profileId);
        rows.set(profileId, {
          stripe_account_id: null,
          details_submitted: false,
          charges_enabled: false,
          payouts_enabled: false,
          bookable_without_payouts: false,
          created_at: now,
          ...existing,
          ...row,
          updated_at: now,
        } as PayoutAccountRow);
        return { data: null, error: null };
      },

      update: (patch: Record<string, unknown>) =>
        new FakeMutationQuery<PayoutAccountRow>((matches) => {
          const existing = [...rows.values()].find(matches);
          if (!existing) return { data: null, count: 0 };
          const updated = { ...existing, ...patch, updated_at: new Date().toISOString() };
          rows.set(existing.profile_id, updated);
          return { data: updated, count: 1 };
        }),
    };
  }

  private paymentsTable() {
    const rows = this.payments;

    return {
      select: () => new FakeSelectQuery<PaymentRow>(() => [...rows.values()]),

      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async (): Promise<QueryResult> => {
            const now = new Date().toISOString();
            const id = randomUUID();
            const created = {
              payment_intent_id: null,
              checkout_session_id: null,
              charge_id: null,
              currency: 'eur',
              status: 'requires_payment',
              refunded_amount: 0,
              transfer_id: null,
              transfer_amount: null,
              transferred_at: null,
              transfer_attempted_at: null,
              reversed_amount: 0,
              locked_until: null,
              ...row,
              id,
              created_at: now,
              updated_at: now,
            } as PaymentRow;
            rows.set(id, created);
            return { data: created, error: null };
          },
        }),
      }),

      update: (patch: Record<string, unknown>) =>
        new FakeMutationQuery<PaymentRow>((matches) => {
          const existing = [...rows.values()].find(matches);
          if (!existing) return { data: null, count: 0 };
          const updated = { ...existing, ...patch, updated_at: new Date().toISOString() };
          rows.set(existing.id, updated);
          return { data: updated, count: 1 };
        }),
    };
  }

  private reviewReportsTable() {
    const rows = this.reviewReports;

    return {
      select: () => new FakeSelectQuery<ReviewReportRow>(() => [...rows]),

      /** The (review_id, reporter_id) primary key: one report per person per review. */
      insert: async (row: Record<string, unknown>): Promise<QueryResult> => {
        if (rows.some((report) => report.review_id === row.review_id && report.reporter_id === row.reporter_id)) {
          return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        }
        rows.push({ ...(row as unknown as ReviewReportRow), details: (row.details as string | null | undefined) ?? null, created_at: new Date().toISOString() });
        return { data: null, error: null };
      },
    };
  }

  private favoritesTable() {
    const rows = this.favorites;
    const key = (row: { particulier_id: unknown; coiffeur_id: unknown }) => `${row.particulier_id as string}:${row.coiffeur_id as string}`;

    return {
      select: () => new FakeSelectQuery<FavoriteRow>(() => [...rows.values()]),

      /** `onConflict: 'particulier_id,coiffeur_id'` with `ignoreDuplicates`, like PostgREST. Each new row a moment after the last. */
      upsert: async (row: Record<string, unknown>, options?: { ignoreDuplicates?: boolean }): Promise<QueryResult> => {
        const existing = rows.get(key(row as { particulier_id: unknown; coiffeur_id: unknown }));
        if (existing && options?.ignoreDuplicates) return { data: null, error: null };
        this.lastFavoriteAt = Math.max(Date.now(), this.lastFavoriteAt + 1);
        rows.set(key(row as { particulier_id: unknown; coiffeur_id: unknown }), {
          ...(row as unknown as FavoriteRow),
          created_at: existing?.created_at ?? new Date(this.lastFavoriteAt).toISOString(),
        });
        return { data: null, error: null };
      },

      delete: () =>
        new FakeMutationQuery<FavoriteRow>((matches) => {
          const existing = [...rows.values()].find(matches);
          if (!existing) return { data: null, count: 0 };
          rows.delete(key(existing));
          return { data: existing, count: 1 };
        }),
    };
  }

  private platformSettingsTable() {
    return {
      select: () => new FakeSelectQuery<PlatformSettingsRow>(() => [this.platformSettings]),

      update: (patch: Record<string, unknown>) =>
        new FakeMutationQuery<PlatformSettingsRow>((matches) => {
          if (!matches(this.platformSettings)) {
            return { data: null, count: 0 };
          }
          this.platformSettings = { ...this.platformSettings, ...patch, updated_at: new Date().toISOString() };
          return { data: this.platformSettings, count: 1 };
        }),
    };
  }

  private adSlotsTable() {
    const rows = this.adSlots;

    return {
      select: () => new FakeSelectQuery<AdSlotRow>(() => [...rows.values()]),

      update: (patch: Record<string, unknown>) =>
        new FakeMutationQuery<AdSlotRow>((matches) => {
          const existing = [...rows.values()].find(matches);
          if (!existing) {
            return { data: null, count: 0 };
          }
          const updated = { ...existing, ...patch, updated_at: new Date().toISOString() };
          rows.set(existing.id, updated);
          return { data: updated, count: 1 };
        }),
    };
  }

  private appContentTable() {
    const rows = this.appContent;

    return {
      select: () => new FakeSelectQuery<AppContentRow>(() => [...rows.values()]),

      update: (patch: Record<string, unknown>) =>
        new FakeMutationQuery<AppContentRow>((matches) => {
          const existing = [...rows.values()].find(matches);
          if (!existing) {
            return { data: null, count: 0 };
          }
          const updated = { ...existing, ...patch, updated_at: new Date().toISOString() };
          rows.set(existing.key, updated);
          return { data: updated, count: 1 };
        }),
    };
  }
}
