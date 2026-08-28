import { IsIn } from 'class-validator';

export class ModerateReviewDto {
  @IsIn(['hide', 'restore'])
  decision!: 'hide' | 'restore';
}
