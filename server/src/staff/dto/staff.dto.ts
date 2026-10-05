import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { AvailabilityDayDto } from '../../salon/dto/availability-day.dto';

/** PATCH /salon/me/staff/:id */
export class UpdateStaffDto {
  @IsBoolean()
  takesBookings!: boolean;
}

/** PUT /salon/me/staff/:id/hours — the whole week, or `null` for the salon's hours. */
export class StaffHoursDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityDayDto)
  days!: AvailabilityDayDto[] | null;
}

/** POST /staff/join — the owner's code, however it was typed. */
export class JoinSalonDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Length(6, 6)
  code!: string;
}
