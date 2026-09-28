import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsUUID, Matches } from 'class-validator';

/** `GET /appointments/salon/:coiffeurId/slots?date=2026-10-07&serviceIds=a,b` — or `&appointmentId=` to move one. */
export class SlotsQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  /** Comma-separated in the query string. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').filter((id) => id.length > 0) : value,
  )
  @IsArray()
  @ArrayMaxSize(6)
  @IsUUID('all', { each: true })
  serviceIds?: string[];

  @IsOptional()
  @IsUUID()
  appointmentId?: string;
}
