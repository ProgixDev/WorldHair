export interface FakeAuthUser {
  id: string;
  email: string;
  email_confirmed_at: string | null;
}

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string;
}

interface QueryResult {
  data: unknown;
  error: { code?: string; message: string } | null;
}

/**
 * Stands in for `SupabaseService` in e2e tests, the way `FakeMailService`
 * stands in for real SMTP in the mongodb variant's tests. There is no
 * in-memory Supabase/Postgres equivalent to `mongodb-memory-server`, so this
 * is a hand-rolled double implementing just enough of the supabase-js surface
 * this template's own code calls: `auth.getUser(token)` and the
 * `.from('profiles').select/update/eq/limit/maybeSingle` chain used by
 * `UsersService` and the readiness check.
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
      if (table !== 'profiles') {
        throw new Error(`FakeSupabaseService: unsupported table "${table}"`);
      }
      return this.profilesTable();
    },
  };

  /** Registers a token as belonging to a signed-up-and-verified user, and seeds their (initially empty) profile row — mirroring `handle_new_user()`. */
  addUser(token: string, user: FakeAuthUser): void {
    this.authUsersByToken.set(token, user);
    if (!this.profiles.has(user.id)) {
      this.profiles.set(user.id, { id: user.id, username: null, display_name: '' });
    }
  }

  reset(): void {
    this.authUsersByToken.clear();
    this.profiles.clear();
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
              if (
                patch.username != null &&
                [...profiles.values()].some((row) => row.id !== id && row.username === patch.username)
              ) {
                return {
                  data: null,
                  error: { code: '23505', message: 'duplicate key value violates unique constraint' },
                };
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
}
