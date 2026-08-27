import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  /** 6-digit code from the emailed message. */
  @IsString()
  @Matches(/^\d{6}$/, { message: 'token must be a 6-digit code' })
  token!: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(128)
  password!: string;
}
