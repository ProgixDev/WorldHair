import { Body, Controller, Get, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminUsersService } from './admin-users.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { AdminUserDto } from './dto/admin-user.dto';

/**
 * `@Roles('admin')` only — deliberately excludes `admin_limited`, since
 * creating (or even just seeing who else has) admin access is the one
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
}
