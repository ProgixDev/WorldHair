import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { ReviewDto, ReviewsService } from './reviews.service';

/**
 * "Signalement / modération avis (admin)" (TODO.md → Back-office admin).
 * No web admin UI consumes this yet — same "API first" pattern as
 * AdminCoiffeurApplicationsController.
 */
@Roles('admin', 'admin_limited')
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('reported')
  listReported(): Promise<ReviewDto[]> {
    return this.reviews.listReported();
  }

  @Patch(':id/moderate')
  moderate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ModerateReviewDto): Promise<void> {
    return this.reviews.moderate(id, dto.decision);
  }
}
