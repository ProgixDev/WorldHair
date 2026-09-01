import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { toPaginationOptions } from '../common/dto/pagination-query.dto';
import { CoiffeurApplicationsService } from './coiffeur-applications.service';
import { CoiffeurApplicationDto, toCoiffeurApplicationDto } from './dto/application.dto';
import { ListCoiffeurApplicationsQueryDto } from './dto/list-applications-query.dto';
import { ReviewCoiffeurApplicationDto } from './dto/review-application.dto';

/**
 * Admin review queue for coiffeur onboarding — the "Liste + validation/rejet
 * dossiers coiffeurs" line under TODO.md → Back-office admin, built here
 * since it's the same table this module already owns. Both admin tiers via
 * `@Roles('admin', 'admin_limited')`, enforced by the global `RolesGuard`.
 */
@Roles('admin', 'admin_limited')
@Controller('admin/coiffeur-applications')
export class AdminCoiffeurApplicationsController {
  constructor(private readonly applications: CoiffeurApplicationsService) {}

  @Get()
  async list(@Query() query: ListCoiffeurApplicationsQueryDto): Promise<CoiffeurApplicationDto[]> {
    const applications = await this.applications.listByStatus(
      query.status,
      toPaginationOptions(query),
    );
    return applications.map(toCoiffeurApplicationDto);
  }

  /** Backs the admin "Voir le profil" link — the coiffeur's own dossier, looked up by their profile id rather than by application id. */
  @Get('by-profile/:profileId')
  async getByProfileId(
    @Param('profileId', ParseUUIDPipe) profileId: string,
  ): Promise<CoiffeurApplicationDto | null> {
    const application = await this.applications.getMine(profileId);
    return application ? toCoiffeurApplicationDto(application) : null;
  }

  @Patch(':id/decision')
  async decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewCoiffeurApplicationDto,
  ): Promise<CoiffeurApplicationDto> {
    const application = await this.applications.decide(id, dto.decision, dto.message);
    return toCoiffeurApplicationDto(application);
  }

  /** Signed URLs (10 min) for the identity/diploma/kbis/invoice documents. */
  @Get(':id/document-urls')
  async documentUrls(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, string | null>> {
    return this.applications.getDocumentUrls(id);
  }
}
