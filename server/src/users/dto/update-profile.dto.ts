import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName?: string;

  /** Same field mobile writes directly via Supabase — no shape enforced yet, avatar upload isn't wired up. */
  @IsOptional()
  @IsString()
  photoUrl?: string;
}
