import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAppContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  heading?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  /** Empty string clears the image. */
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
