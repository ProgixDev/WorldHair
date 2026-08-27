import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { USERNAME_PATTERN } from '../username.util';

export class UpdateProfileDto {
  /** Lowercase handle, 3-20 of `[a-z0-9_]`. Uniqueness is enforced by the index, surfaced as a 409. */
  @IsOptional()
  @IsString()
  @Matches(USERNAME_PATTERN, {
    message: 'username must be 3-20 characters of lowercase letters, digits or underscores',
  })
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  displayName?: string;
}
