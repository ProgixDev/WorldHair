import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MaxLength, MinLength } from 'class-validator';
import { Specialty, SPECIALTIES } from './update-salon-profile.dto';

export class CreateServiceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  /** Euros, TTC. */
  @IsNumber()
  @Min(0.01)
  price!: number;

  @IsInt()
  @Min(1)
  durationMin!: number;

  @IsIn(SPECIALTIES)
  specialty!: Specialty;
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMin?: number;

  @IsOptional()
  @IsIn(SPECIALTIES)
  specialty?: Specialty;
}
