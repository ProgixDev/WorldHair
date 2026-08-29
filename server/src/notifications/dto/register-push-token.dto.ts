import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  token!: string;

  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';

  /** IANA zone (e.g. "Europe/Paris") — captured client-side via Intl.DateTimeFormat().resolvedOptions().timeZone. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;
}
