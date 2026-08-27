import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Registration is deliberately minimal: an email and a password create the
 * auth identity, nothing more. Profile fields (username, displayName) are
 * optional and set afterwards via `PATCH /users/me` — keeping "create an
 * account" and "build a profile" as two separate concerns.
 */
export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(128)
  password!: string;
}
