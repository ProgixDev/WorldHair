import { User } from '../schemas/user.schema';

/**
 * The signed-in user's own account. Only ever returned to that user — auth
 * responses and `GET /users/me`.
 */
export class UserDto {
  id!: string;
  email!: string;
  username!: string;
  displayName!: string;
  emailVerified!: boolean;
}

export function toUserDto(user: User & { id: string }): UserDto {
  return {
    id: user.id,
    email: user.email,
    // `?? ''` rather than `!`: `username` is optional in the schema until the
    // user chooses one, and a serialized account without it would otherwise
    // be a type lie.
    username: user.username ?? '',
    displayName: user.displayName,
    emailVerified: user.emailVerified,
  };
}
