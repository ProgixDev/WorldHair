import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { AdminUsersService } from './admin-users.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { AdminUserDto } from './dto/admin-user.dto';

/**
 * `@Roles('admin')` only — deliberately excludes `admin_limited`, since
 * creating, removing, or even just seeing who else has admin access is
 * capability the lower tier doesn't get.
 */
@Roles('admin')
@Controller('admin/admins')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  list(): Promise<AdminUserDto[]> {
    return this.adminUsers.list();
  }

  @Post()
  create(@Body() dto: CreateAdminDto): Promise<AdminUserDto> {
    return this.adminUsers.create(dto.email, dto.password);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() current: AuthenticatedUser): Promise<void> {
    return this.adminUsers.remove(id, current.id);
  }
}
