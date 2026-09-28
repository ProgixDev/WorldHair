import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdatePlatformSettingsDto {
  /** 0 = no trial: the first charge happens at Checkout. Same bounds as schema.sql. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  trialDays?: number;

  /** Percent of each prestation WorldHair keeps; two decimals at most, like schema.sql's numeric(5, 2). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionPercent?: number;
}
