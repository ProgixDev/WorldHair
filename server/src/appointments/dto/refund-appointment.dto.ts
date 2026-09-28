import { IsNumber, IsOptional, Min } from 'class-validator';

export class RefundAppointmentDto {
  /** Euros; everything left to refund when omitted. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;
}
