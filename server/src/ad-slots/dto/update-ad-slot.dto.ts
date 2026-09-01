import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAdSlotDto {
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  headline?: string;

  /** Empty string clears the image (back to no visual). */
  @IsOptional()
  @IsString()
  imageUrl?: string;

  /** Empty string clears the link. */
  @IsOptional()
  @IsString()
  linkUrl?: string;
}
