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

/**
 * Hand-rolled stand-in for the one `.select().eq().order().range()`-shaped
 * query `CoiffeurApplicationsService.listByStatus` builds — a hard-coded
 * shape (like the rest of this file), not a general query engine. Every
 * intermediate step is itself awaitable (`then`), matching how supabase-js's
 * real builders work: `await query` and `await query.eq(...)` both resolve.
 */
type ApplicationColumn = 'status' | 'profile_id' | 'id';

class FakeApplicationsQuery implements PromiseLike<QueryResult> {
  private readonly eqFilters: [ApplicationColumn, unknown][] = [];
  private rangeFrom = 0;
  private rangeTo = Number.MAX_SAFE_INTEGER;

  constructor(private readonly rows: () => CoiffeurApplicationRow[]) {}

  eq(column: ApplicationColumn, value: unknown): this {
    this.eqFilters.push([column, value]);
    return this;
  }

  order(): this {
    return this; // Rows are already read back in submission order.
  }

  range(from: number, to: number): this {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  private filtered(): CoiffeurApplicationRow[] {
    let rows = this.rows();
    for (const [column, value] of this.eqFilters) {
      rows = rows.filter((row) => row[column] === value);
    }
    return rows.slice(this.rangeFrom, this.rangeTo + 1);
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

  readonly client = {
    auth: {
      getUser: async (token: string) => {
        const user = this.authUsersByToken.get(token);
        if (!user) {
          return { data: { user: null }, error: { message: 'invalid token' } };
        }
        return { data: { user }, error: null };
      },
    },
    from: (table: string) => {
      if (table === 'profiles') {
        return this.profilesTable();
      }
      if (table === 'coiffeur_applications') {
        return this.coiffeurApplicationsTable();
      }
      throw new Error(`FakeSupabaseService: unsupported table "${table}"`);
    },
  };

  /** Registers a token as belonging to a signed-up-and-verified user, and seeds their (initially empty) profile row — mirroring `handle_new_user()`. */
  addUser(token: string, user: FakeAuthUser, role: string = 'particulier'): void {
    this.authUsersByToken.set(token, user);
    if (!this.profiles.has(user.id)) {
      this.profiles.set(user.id, { id: user.id, first_name: '', last_name: '', photo_url: null, role });
    }
  }

  reset(): void {
    this.authUsersByToken.clear();
    this.profiles.clear();
    this.coiffeurApplications.clear();
  }

  private profilesTable() {
    const profiles = this.profiles;

    return {
      select: () => ({
        eq: (_column: 'id', id: string) => ({
          maybeSingle: async (): Promise<QueryResult> => ({ data: profiles.get(id) ?? null, error: null }),
        }),
        limit: async (count: number): Promise<QueryResult> => ({
          data: [...profiles.values()].slice(0, count),
          error: null,
        }),
      }),
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
      select: () => new FakeApplicationsQuery(() => [...apps.values()]),

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
        eq: (column: ApplicationColumn, value: unknown) => {
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
}
