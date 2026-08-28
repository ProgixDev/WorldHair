import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(400)
  reason?: string;
}
