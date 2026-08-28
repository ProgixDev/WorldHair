import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID()
  coiffeurId!: string;

  @IsUUID()
  serviceId!: string;

  @IsISO8601()
  startsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  note?: string;
}
