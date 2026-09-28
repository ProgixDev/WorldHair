import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Specialty, SPECIALTIES } from '../../salon/dto/update-salon-profile.dto';
import type { SalonSort } from '../discovery.service';

export const SALON_SORTS: SalonSort[] = ['distance', 'rating', 'price', 'availability'];

/** `a,b` or a repeated parameter: a list either way. */
const toList = ({ value }: { value: unknown }): unknown =>
  value === undefined || value === '' ? undefined : Array.isArray(value) ? value : String(value).split(',');

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

  /** One specialty — what older app versions send; `specialties` takes several. */
  @IsOptional()
  @IsIn(SPECIALTIES)
  specialty?: Specialty;

  /** Salons offering any of these. */
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @IsIn(SPECIALTIES, { each: true })
  specialties?: Specialty[];

  /** Manual-location mode — exact city match (case-insensitive). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  /** Every word, accents aside: the salon, its coiffeur, tagline, address, city and prestations. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;

  /** A visible prestation priced within the range, in euros. */
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  priceMax?: number;

  /** Open right now, Paris time. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  openNow?: boolean;

  /** Open on this Paris day. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'openOn must be YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'openOn must be a real day' })
  openOn?: string;

  /** Still open after this time (HH:MM, Paris): on `openOn`, or on any day. */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'openAfter must be HH:MM' })
  openAfter?: string;

  @IsOptional()
  @IsIn(['salon', 'domicile'])
  practiceZone?: 'salon' | 'domicile';

  /** The map's visible area: minLat,minLng,maxLat,maxLng. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    const list = toList({ value });
    return Array.isArray(list) ? list.map(Number) : list;
  })
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @IsNumber({}, { each: true })
  bounds?: [number, number, number, number];

  @IsOptional()
  @IsIn(SALON_SORTS)
  sort?: SalonSort;
}
