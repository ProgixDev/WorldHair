import { IsIn } from 'class-validator';
import { Attendance } from '../appointments.service';

export class AttendanceDto {
  @IsIn(['attended', 'no_show'])
  attendance!: Attendance;
}
