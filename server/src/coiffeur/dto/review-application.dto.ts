import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ReviewDecision {
  Validated = 'validated',
  Rejected = 'rejected',
}

/** Body for `PATCH /admin/coiffeur-applications/:id/decision`. */
export class ReviewCoiffeurApplicationDto {
  @IsEnum(ReviewDecision)
  decision!: ReviewDecision;

  /** Shown to the coiffeur on a rejection; ignored for an approval. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
