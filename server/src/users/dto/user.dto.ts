import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { Role } from '../../common/types/role';
import { TERMS_VERSION } from '../terms';
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
  /** The CGU and privacy policy version accepted, and when; null until they were. */
  termsVersion!: string | null;
  termsAcceptedAt!: string | null;
  /** Accepted the version in force (../terms.ts): the apps ask again otherwise. */
  termsUpToDate!: boolean;
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
    termsVersion: profile.termsVersion,
    termsAcceptedAt: profile.termsAcceptedAt,
    termsUpToDate: profile.termsVersion === TERMS_VERSION,
  };
}
