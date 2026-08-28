import { Body, Controller, Get, NotFoundException, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { CoiffeurApplicationsService } from './coiffeur-applications.service';
import { CoiffeurApplicationDto, toCoiffeurApplicationDto } from './dto/application.dto';
import { SubmitCoiffeurApplicationDto } from './dto/submit-application.dto';

/**
 * Self-service side of coiffeur onboarding: submit (or resubmit after a
 * rejection), check status, and complete the mandatory post-approval
 * shop-profile step (issue #7). Any authenticated caller may hit these —
 * submitting IS how a particulier becomes a coiffeur, so there's no
 * `@Roles()` gate here (see `admin-coiffeur-applications.controller.ts` for
 * the reviewer side).
 */
@Controller('coiffeur/applications')
export class CoiffeurApplicationsController {
  constructor(private readonly applications: CoiffeurApplicationsService) {}

  @Get('me')
  async getMine(@CurrentUser() current: AuthenticatedUser): Promise<CoiffeurApplicationDto> {
    const application = await this.applications.getMine(current.id);
    if (!application) {
      throw new NotFoundException('No coiffeur application found');
    }
    return toCoiffeurApplicationDto(application);
  }

  @Post()
  async submit(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: SubmitCoiffeurApplicationDto,
  ): Promise<CoiffeurApplicationDto> {
    const application = await this.applications.submit(current.id, dto);
    return toCoiffeurApplicationDto(application);
  }

  @Patch('me/shop-profile')
  async completeShopProfile(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<CoiffeurApplicationDto> {
    const application = await this.applications.completeShopProfile(current.id);
    return toCoiffeurApplicationDto(application);
  }
}
