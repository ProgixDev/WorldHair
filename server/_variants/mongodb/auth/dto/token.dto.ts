import { IsString, Matches } from 'class-validator';

export class TokenDto {
  /** 6-digit code from the emailed message. */
  @IsString()
  @Matches(/^\d{6}$/, { message: 'token must be a 6-digit code' })
  token!: string;
}
