import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { Role } from '../../common/types/role';
import { Profile } from '../users.service';

/**
 * The signed-in user's own account. Only ever returned to that user — auth
 * responses and `GET /users/me`.
 *
 * `id`/`email`/`emailVerified`/`role` come from Supabase Auth + the
 * `profiles` row (`AuthenticatedUser`, resolved by `JwtAuthGuard` — see
 * `auth/strategies/supabase.strategy.ts`); `username`/`displayName` come from
 * that same `profiles` Postgres row managed by `users.service.ts`.
 */
export class UserDto {
  id!: string;
  email!: string;
  username!: string;
  displayName!: string;
  emailVerified!: boolean;
  role!: Role;
}

export function toUserDto(user: AuthenticatedUser, profile: Profile): UserDto {
  return {
    id: user.id,
    email: user.email,
    username: profile.username ?? '',
    displayName: profile.displayName,
    emailVerified: user.emailVerified,
    role: user.role,
  };
}
