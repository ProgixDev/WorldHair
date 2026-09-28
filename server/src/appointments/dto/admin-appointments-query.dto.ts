import { IsIn, IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ADMIN_APPOINTMENT_STATUSES, type AdminAppointmentStatusFilter } from '../admin-appointments.service';

/** `GET /admin/appointments`: the filters of the admins' « Rendez-vous » page, and its page. */
export class AdminAppointmentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(ADMIN_APPOINTMENT_STATUSES)
  status?: AdminAppointmentStatusFilter;

  /** Words of the salon's name, or its coiffeur's. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  salon?: string;

  /** Words of the client's name. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  client?: string;

  /** Starting on or after this Paris day — this century's. */
  @IsOptional()
  @Matches(/^20\d{2}-\d{2}-\d{2}$/, { message: 'from must be YYYY-MM-DD, from 2000 to 2099' })
  @IsISO8601({ strict: true }, { message: 'from must be a real day' })
  from?: string;

  /** Starting on or before this Paris day — this century's. */
  @IsOptional()
  @Matches(/^20\d{2}-\d{2}-\d{2}$/, { message: 'to must be YYYY-MM-DD, from 2000 to 2099' })
  @IsISO8601({ strict: true }, { message: 'to must be a real day' })
  to?: string;
}
