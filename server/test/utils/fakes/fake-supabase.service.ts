import { randomUUID } from 'crypto';

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
  created_at: string;
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

interface CoiffeurMessageRow {
  id: string;
  coiffeur_id: string;
  sender_role: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

interface SubscriptionRow {
  profile_id: string;
  plan: string;
  status: string;
  trial_ends_at: string | null;
  renews_at: string;
  created_at: string;
  updated_at: string;
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

function matchesAll<TRow extends object>(row: TRow, filters: [keyof TRow, unknown][]): boolean {
  return filters.every(([column, value]) => row[column] === value);
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
      .filter((row) => this.gteFilters.every(([column, value]) => this.compare(row[column], value) >= 0))
      .filter((row) => this.lteFilters.every(([column, value]) => this.compare(row[column], value) <= 0));
    return rows.slice(this.rangeFrom, this.rangeTo + 1);
  }

  /** Compares as dates when both sides parse as one (ISO timestamp columns), otherwise falls back to `<`/`>`. */
  private compare(a: unknown, b: unknown): number {
    const aDate = new Date(a as string).getTime();
    const bDate = new Date(b as string).getTime();
    if (!Number.isNaN(aDate) && !Number.isNaN(bDate)) return aDate - bDate;
    if ((a as number) < (b as number)) return -1;
    if ((a as number) > (b as number)) return 1;
    return 0;
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

/** A `.update()/.delete()` chain: N `.eq()` filters, then a terminal call. */
class FakeMutationQuery<TRow extends object> {
  private readonly eqFilters: [keyof TRow, unknown][] = [];

  constructor(private readonly apply: (matches: (row: TRow) => boolean) => { data: TRow | null; count: number }) {}

  eq(column: keyof TRow, value: unknown): this {
    this.eqFilters.push([column, value]);
    return this;
  }

  private run() {
    return this.apply((row) => matchesAll(row, this.eqFilters));
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
  private readonly appointments = new Map<string, AppointmentRow>();
  private readonly reviews = new Map<string, ReviewRow>();
  private readonly pushTokens = new Map<string, PushTokenRow>();
  private readonly notificationPreferences = new Map<string, NotificationPreferencesRow>();
  private readonly notificationsLog = new Map<string, NotificationLogRow>();
  private readonly coiffeurMessages = new Map<string, CoiffeurMessageRow>();
  private readonly adSlots = new Map<string, AdSlotRow>(defaultAdSlots());
  private readonly appContent = new Map<string, AppContentRow>(defaultAppContent());
  private readonly subscriptions = new Map<string, SubscriptionRow>();

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
        listUsers: async (_options: { page: number; perPage: number }) => ({
          data: { users: [...this.authUsersByToken.values()] },
          error: null,
        }),
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
      if (table === 'appointments') {
        return this.appointmentsTable();
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
      if (table === 'coiffeur_messages') {
        return this.coiffeurMessagesTable();
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
      throw new Error(`FakeSupabaseService: unsupported table "${table}"`);
    },
    rpc: async (fn: string, params: Record<string, unknown> = {}) => {
      if (fn === 'search_salons') {
        return this.searchSalonsRpc(params);
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
    this.appointments.clear();
    this.reviews.clear();
    this.pushTokens.clear();
    this.notificationPreferences.clear();
    this.notificationsLog.clear();
    this.coiffeurMessages.clear();
    this.adSlots.clear();
    for (const [id, row] of defaultAdSlots()) this.adSlots.set(id, row);
    this.appContent.clear();
    for (const [key, row] of defaultAppContent()) this.appContent.set(key, row);
    this.subscriptions.clear();
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
      created_at: params.createdAt ?? new Date().toISOString(),
    });
    return id;
  }

  /** Test convenience: reads back what notifications/ actually recorded for a user, for assertions. */
  notifyLogFor(userId: string): NotificationLogRow[] {
    return [...this.notificationsLog.values()].filter((row) => row.user_id === userId);
  }

  /** Test convenience: seeds or overwrites a `coiffeur_subscriptions` row directly, bypassing SubscriptionsService's own get-or-create/plan-change flow. */
  seedSubscription(params: {
    profileId: string;
    plan?: string;
    status?: string;
    trialEndsAt?: string | null;
    renewsAt?: string;
  }): void {
    const existing = this.subscriptions.get(params.profileId);
    const now = new Date().toISOString();
    this.subscriptions.set(params.profileId, {
      profile_id: params.profileId,
      plan: params.plan ?? existing?.plan ?? 'monthly',
      status: params.status ?? existing?.status ?? 'trial',
      trial_ends_at: params.trialEndsAt !== undefined ? params.trialEndsAt : (existing?.trial_ends_at ?? null),
      renews_at: params.renewsAt ?? existing?.renews_at ?? now,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    });
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
    status?: string;
    shopProfileComplete?: boolean;
  }): void {
    const existing = this.coiffeurApplications.get(params.profileId);
    this.coiffeurApplications.set(params.profileId, {
      id: existing?.id ?? randomUUID(),
      profile_id: params.profileId,
      first_name: params.firstName ?? existing?.first_name ?? '',
      last_name: params.lastName ?? existing?.last_name ?? '',
      phone: existing?.phone ?? '',
      salon_name: existing?.salon_name ?? '',
      description: existing?.description ?? '',
      practice_zone: existing?.practice_zone ?? 'salon',
      address_line: existing?.address_line ?? null,
      postal_code: existing?.postal_code ?? null,
      city: existing?.city ?? null,
      invoice_document_path: existing?.invoice_document_path ?? null,
      travel_radius_km: existing?.travel_radius_km ?? null,
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
    services?: { name: string; price: number; durationMin: number; specialty: string }[];
  }): void {
    this.seedApplication({
      profileId: params.profileId,
      firstName: params.firstName,
      lastName: params.lastName,
      status: 'validated',
      shopProfileComplete: true,
    });
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
      });
    }
  }

  private searchSalonsRpc(params: Record<string, unknown>): QueryResult {
    const lat = params.p_lat as number | null | undefined;
    const lng = params.p_lng as number | null | undefined;
    const radiusKm = (params.p_radius_km as number | null | undefined) ?? null;
    const specialty = (params.p_specialty as string | null | undefined) ?? null;
    const city = (params.p_city as string | null | undefined) ?? null;
    const query = (params.p_query as string | null | undefined) ?? null;
    const limit = (params.p_limit as number | undefined) ?? 20;
    const offset = (params.p_offset as number | undefined) ?? 0;
    const origin = lat != null && lng != null ? { lat, lng } : null;

    const rows = [...this.salonProfiles.values()]
      .map((profile) => ({
        profile,
        application: [...this.coiffeurApplications.values()].find((app) => app.profile_id === profile.profile_id),
      }))
      .filter(({ application }) => application?.status === 'validated' && application?.shop_profile_complete === true)
      .filter(({ profile }) => specialty == null || profile.specialties.includes(specialty))
      .filter(({ profile }) => city == null || profile.city.toLowerCase() === city.toLowerCase())
      .filter(({ profile }) => query == null || profile.salon_name.toLowerCase().includes(query.toLowerCase()))
      .map(({ profile, application }) => {
        const distanceKm =
          origin && profile.latitude != null && profile.longitude != null
            ? haversineKm(origin, { lat: profile.latitude, lng: profile.longitude })
            : null;
        const services = [...this.services.values()].filter((s) => s.profile_id === profile.profile_id);
        const priceFrom = services.length > 0 ? Math.min(...services.map((s) => Number(s.price))) : null;
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
          price_from: priceFrom,
          distance_km: distanceKm,
        };
      })
      // A salon with no known location is excluded from a radius search, not
      // passed through by virtue of "we can't check" — mirrors search_salons().
      .filter(
        (row) =>
          radiusKm == null || origin == null || (row.distance_km != null && row.distance_km <= radiusKm),
      )
      .sort((a, b) => {
        if ((a.distance_km == null) !== (b.distance_km == null)) return a.distance_km == null ? 1 : -1;
        if (a.distance_km != null && b.distance_km != null && a.distance_km !== b.distance_km) {
          return a.distance_km - b.distance_km;
        }
        return b.rating - a.rating;
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

      /** Eager write (unlike coiffeur_applications' upsert above) — simpler, and nothing here needs the lazy-until-awaited shape. */
      upsert: (row: Record<string, unknown>) => {
        const profileId = row.profile_id as string;
        const existing = rows.get(profileId);
        // Mirrors real Postgres column defaults on a fresh insert — SalonService's
        // own patch never sets these (rating/review_count/badges are seed/system-only).
        const defaults = existing
          ? {}
          : { latitude: null, longitude: null, rating: 0, review_count: 0, badges: [] };
        const merged = { ...defaults, ...existing, ...row } as SalonProfileRow;
        rows.set(profileId, merged);
        return {
          select: () => ({
            single: async (): Promise<QueryResult> => ({ data: merged, error: null }),
          }),
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
            const created = { ...row, id } as ServiceRow;
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

  private appointmentsTable() {
    const rows = this.appointments;

    return {
      select: () => new FakeSelectQuery<AppointmentRow>(() => [...rows.values()]),

      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async (): Promise<QueryResult> => {
            const id = randomUUID();
            const created = { ...row, id, created_at: new Date().toISOString() } as AppointmentRow;
            rows.set(id, created);
            return { data: created, error: null };
          },
        }),
      }),

      update: (patch: Record<string, unknown>) =>
        new FakeMutationQuery<AppointmentRow>((matches) => {
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

  private coiffeurMessagesTable() {
    const rows = this.coiffeurMessages;

    return {
      select: () => new FakeSelectQuery<CoiffeurMessageRow>(() => [...rows.values()]),

      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async (): Promise<QueryResult> => {
            const id = randomUUID();
            const created = {
              read_at: null,
              ...row,
              id,
              created_at: new Date().toISOString(),
            } as CoiffeurMessageRow;
            rows.set(id, created);
            return { data: created, error: null };
          },
        }),
      }),

      update: (patch: Record<string, unknown>) =>
        new FakeMutationQuery<CoiffeurMessageRow>((matches) => {
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

  private subscriptionsTable() {
    const rows = this.subscriptions;

    return {
      select: () => new FakeSelectQuery<SubscriptionRow>(() => [...rows.values()]),

      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async (): Promise<QueryResult> => {
            const now = new Date().toISOString();
            const created = { ...row, created_at: now, updated_at: now } as SubscriptionRow;
            rows.set(created.profile_id, created);
            return { data: created, error: null };
          },
        }),
      }),

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
