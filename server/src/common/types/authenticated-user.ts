import { Role } from './role';

export interface AuthenticatedUser {
  id: string;
  email: string;
  emailVerified: boolean;
  /** From `profiles.role` — see `auth/strategies/supabase.strategy.ts`. */
  role: Role;
}
