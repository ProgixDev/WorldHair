import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator';

const MAX_MINUTE = 24 * 60 - 1;

export class AvailabilityDayDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @IsBoolean()
  isOpen!: boolean;

  @IsInt()
  @Min(0)
  @Max(MAX_MINUTE)
  opensMinute!: number;

  @IsInt()
  @Min(0)
  @Max(MAX_MINUTE)
  closesMinute!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MINUTE)
  breakStartMinute?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MINUTE)
  breakEndMinute?: number | null;
}

/** Body for `PUT /salon/me/availability` — mobile always saves the whole week at once. */
export class ReplaceAvailabilityDto {
  @ValidateNested({ each: true })
  @Type(() => AvailabilityDayDto)
  days!: AvailabilityDayDto[];
}
