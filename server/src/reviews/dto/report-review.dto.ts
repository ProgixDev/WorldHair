import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { REPORT_REASONS, ReportReason } from '../reviews.service';

export class ReportReviewDto {
  @IsIn(REPORT_REASONS)
  reason!: ReportReason;

  /** What the reporter adds in their own words. */
  @IsOptional()
  @IsString()
  @MaxLength(400)
  details?: string;
}
