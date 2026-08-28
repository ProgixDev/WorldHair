/** Mirrors the `profiles.role` check constraint in `_variants/supabase/schema.sql`. */
export type Role = 'particulier' | 'coiffeur' | 'admin';

export const ROLES: readonly Role[] = ['particulier', 'coiffeur', 'admin'];
