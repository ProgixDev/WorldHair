import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshDto {
  // Deliberately NOT @IsJWT(): a structurally malformed token (e.g. "not-a-jwt")
  // must still reach TokensService, which reports it as an invalid/expired
  // refresh token (401) rather than a request-shape error (400) — same
  // "don't help an attacker distinguish failure modes" reasoning as login.
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
