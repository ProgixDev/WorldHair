import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

/** Mirrors mobile's TAGS in app/review/[appointmentId].tsx. */
export const REVIEW_TAGS = [
  'Ponctualité',
  'Écoute',
  'Résultat',
  'Ambiance',
  'Propreté',
  'Conseils',
  'Rapport qualité-prix',
] as const;

export class CreateReviewDto {
  @IsUUID()
  appointmentId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsArray()
  @IsIn(REVIEW_TAGS, { each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
