import { IsUUID } from 'class-validator';

/** PATCH /appointments/:id/assign — someone else of the team does it (TODO.md Phase 3). */
export class AssignAppointmentDto {
  @IsUUID()
  staffId!: string;
}
