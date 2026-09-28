import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { ModeratedReviewDto, ReviewsService } from './reviews.service';

/**
 * "Signalement / modération avis (admin)" — the web admin's « Avis » page:
 * the reported reviews with who reported them and why, the hidden ones to
 * put back, and the decision on each.
 */
@Roles('admin', 'admin_limited')
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('reported')
  listReported(): Promise<ModeratedReviewDto[]> {
    return this.reviews.listReported();
  }

  @Get('hidden')
  listHidden(): Promise<ModeratedReviewDto[]> {
    return this.reviews.listHidden();
  }

  @Patch(':id/moderate')
  moderate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ModerateReviewDto): Promise<void> {
    return this.reviews.moderate(id, dto.decision);
  }
}
