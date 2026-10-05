import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class DecideAppointmentDto {
  @IsIn(['confirmed', 'refused'])
  decision!: 'confirmed' | 'refused';

  /** Accepting: who in the team does it (« Qui s'en occupe ? ») — the person held when absent. TODO.md Phase 3. */
  @IsOptional()
  @IsUUID()
  staffId?: string;
}
