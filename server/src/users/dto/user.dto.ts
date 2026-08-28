import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { Role } from '../../common/types/role';
import { Profile } from '../users.service';

/**
 * The signed-in user's own account. Only ever returned to that user — auth
 * responses and `GET /users/me`.
 *
 * `id`/`email`/`emailVerified`/`role` come from Supabase Auth + the
 * `profiles` row (`AuthenticatedUser`, resolved by `JwtAuthGuard` — see
 * `auth/strategies/supabase.strategy.ts`); `firstName`/`lastName`/`photoUrl`
 * come from that same `profiles` Postgres row managed by `users.service.ts`.
 */
export class UserDto {
  id!: string;
  email!: string;
  firstName!: string;
  lastName!: string;
  photoUrl!: string | null;
  emailVerified!: boolean;
  role!: Role;
}

export function toUserDto(user: AuthenticatedUser, profile: Profile): UserDto {
  return {
    id: user.id,
    email: user.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    photoUrl: profile.photoUrl,
    emailVerified: user.emailVerified,
    role: user.role,
  };
}
