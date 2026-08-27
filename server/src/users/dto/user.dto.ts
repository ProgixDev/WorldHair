import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { Profile } from '../users.service';

/**
 * The signed-in user's own account. Only ever returned to that user — auth
 * responses and `GET /users/me`.
 *
 * `id`/`email`/`emailVerified` come from Supabase Auth (`AuthenticatedUser`,
 * resolved by `JwtAuthGuard`); `username`/`displayName` come from the
 * `profiles` Postgres row this server manages — see `users.service.ts` and
 * `_variants/supabase/schema.sql`.
 */
export class UserDto {
  id!: string;
  email!: string;
  username!: string;
  displayName!: string;
  emailVerified!: boolean;
}

export function toUserDto(user: AuthenticatedUser, profile: Profile): UserDto {
  return {
    id: user.id,
    email: user.email,
    username: profile.username ?? '',
    displayName: profile.displayName,
    emailVerified: user.emailVerified,
  };
}
