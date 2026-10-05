import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

/** PATCH /appointments/:id/move — the coiffeur's « Déplacer ». */
export class MoveAppointmentDto {
  @IsISO8601()
  startsAt!: string;

  /** Who does it at the new time; absent: its person if free then, else someone free (TODO.md Phase 3). */
  @IsOptional()
  @IsUUID()
  staffId?: string;
}
