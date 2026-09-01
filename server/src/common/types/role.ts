/**
 * Mirrors the `profiles.role` check constraint in
 * `_variants/supabase/schema.sql`. `admin_limited` has every admin capability
 * except creating more admins (see `server/src/admin-users/`) — most
 * `@Roles('admin')` gates should read `@Roles('admin', 'admin_limited')`.
 */
export type Role = 'particulier' | 'coiffeur' | 'admin' | 'admin_limited';

export const ROLES: readonly Role[] = ['particulier', 'coiffeur', 'admin', 'admin_limited'];
