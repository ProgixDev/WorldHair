import { IsIn } from 'class-validator';

export class DecideAppointmentDto {
  @IsIn(['confirmed', 'refused'])
  decision!: 'confirmed' | 'refused';
}
