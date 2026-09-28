import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * A closure is a plain time range: whole days are midnight to midnight
 * (Paris), a few hours of one day are just those hours. The app builds both.
 */
export class CreateTimeOffDto {
  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;

  /** Optional, shown to the coiffeur only ("Congés", "Formation"...). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;
}
