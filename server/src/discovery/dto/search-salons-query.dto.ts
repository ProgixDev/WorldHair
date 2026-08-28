import { Type } from 'class-transformer';
import { IsIn, IsLatitude, IsLongitude, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Specialty, SPECIALTIES } from '../../salon/dto/update-salon-profile.dto';

export class SearchSalonsQueryDto extends PaginationQueryDto {
  /** Geo-radius mode — omit both for manual-location/filter-only search. */
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  radiusKm?: number;

  @IsOptional()
  @IsIn(SPECIALTIES)
  specialty?: Specialty;

  /** Manual-location mode — exact city match (case-insensitive). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  /** Free-text match against the salon name. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;
}
