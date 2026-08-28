import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { ReportReviewDto } from './dto/report-review.dto';
import { ReviewDto, ReviewsService } from './reviews.service';

/**
 * "Avis" (TODO.md). No class-level `@Roles()`: particulier, coiffeur and
 * public routes are mixed here the same way AppointmentsController mixes
 * its two sides — see ReviewsService's single table, multiple lenses.
 */
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post()
  create(@CurrentUser() current: AuthenticatedUser, @Body() dto: CreateReviewDto): Promise<ReviewDto> {
    return this.reviews.create(current.id, dto);
  }

  @Get('me')
  listMine(@CurrentUser() current: AuthenticatedUser): Promise<ReviewDto[]> {
    return this.reviews.listMine(current.id);
  }

  // Declared before 'salon/:coiffeurId' so it isn't swallowed by the param route.
  @Roles('coiffeur')
  @Get('salon/mine')
  listForMySalon(@CurrentUser() current: AuthenticatedUser): Promise<ReviewDto[]> {
    return this.reviews.listForCoiffeurOwner(current.id);
  }

  @Get('salon/:coiffeurId')
  listForSalon(@Param('coiffeurId', ParseUUIDPipe) coiffeurId: string): Promise<ReviewDto[]> {
    return this.reviews.listForSalon(coiffeurId);
  }

  @Roles('coiffeur')
  @Patch(':id/reply')
  reply(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyReviewDto,
  ): Promise<void> {
    return this.reviews.reply(current.id, id, dto.text);
  }

  @Roles('coiffeur')
  @Delete(':id/reply')
  deleteReply(@CurrentUser() current: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.reviews.deleteReply(current.id, id);
  }

  /** Any authenticated caller may report a review they're reading. */
  @Post(':id/report')
  report(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReportReviewDto): Promise<void> {
    return this.reviews.report(id, dto.reason);
  }
}
