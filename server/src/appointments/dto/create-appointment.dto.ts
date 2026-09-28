import { ArrayMaxSize, IsArray, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID()
  coiffeurId!: string;

  /** Prestations in the order picked; they run back to back as one booking. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsUUID('all', { each: true })
  serviceIds?: string[];

  /** What older app versions send: a single prestation. One of the two is required (checked by the service). */
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsISO8601()
  startsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  note?: string;
}
