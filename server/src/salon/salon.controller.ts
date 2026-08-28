import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { ReplaceAvailabilityDto } from './dto/availability-day.dto';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';
import { UpdateSalonProfileDto } from './dto/update-salon-profile.dto';
import { AvailabilityDay, SalonProfile, SalonService, SalonServiceItem } from './salon.service';

/**
 * The coiffeur's own "Mon salon" workspace — presentation page, weekly
 * hours, prestations. `@Roles('coiffeur')` at the class level: nothing here
 * makes sense for a particulier or an admin.
 */
@Roles('coiffeur')
@Controller('salon/me')
export class SalonController {
  constructor(private readonly salon: SalonService) {}

  @Get()
  getProfile(@CurrentUser() current: AuthenticatedUser): Promise<SalonProfile> {
    return this.salon.getProfile(current.id);
  }

  @Patch()
  updateProfile(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: UpdateSalonProfileDto,
  ): Promise<SalonProfile> {
    return this.salon.updateProfile(current.id, dto);
  }

  @Get('availability')
  getAvailability(@CurrentUser() current: AuthenticatedUser): Promise<AvailabilityDay[]> {
    return this.salon.getAvailability(current.id);
  }

  @Put('availability')
  replaceAvailability(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: ReplaceAvailabilityDto,
  ): Promise<AvailabilityDay[]> {
    return this.salon.replaceAvailability(current.id, dto.days);
  }

  @Get('services')
  listServices(@CurrentUser() current: AuthenticatedUser): Promise<SalonServiceItem[]> {
    return this.salon.listServices(current.id);
  }

  @Post('services')
  createService(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: CreateServiceDto,
  ): Promise<SalonServiceItem> {
    return this.salon.createService(current.id, dto);
  }

  @Patch('services/:id')
  updateService(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ): Promise<SalonServiceItem> {
    return this.salon.updateService(current.id, id, dto);
  }

  @Delete('services/:id')
  deleteService(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.salon.deleteService(current.id, id);
  }
}
