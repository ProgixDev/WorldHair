import { IsBoolean, IsOptional } from 'class-validator';

/** Only the two "désactivable" reminders are exposed — the other four notification types are mandatory (TODO.md), so there's nothing to toggle for them. */
export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  reminderDayBefore?: boolean;

  @IsOptional()
  @IsBoolean()
  reminderHourBefore?: boolean;
}
