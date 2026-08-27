import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// A reusable list-pagination convention — lives here (not in a feature-specific
// service file) so any module can share it without importing a type out of
// another feature.
export interface PaginationOptions {
  limit: number;
  offset: number;
}

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export function toPaginationOptions(dto: PaginationQueryDto): PaginationOptions {
  return { limit: dto.limit ?? DEFAULT_LIMIT, offset: dto.offset ?? 0 };
}
