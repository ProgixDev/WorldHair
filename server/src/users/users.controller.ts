import { Body, Controller, Get, HttpCode, NotFoundException, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { toUserDto, UserDto } from './dto/user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() current: AuthenticatedUser): Promise<UserDto> {
    const profile = await this.users.getProfile(current.id);

    if (!profile) {
      throw new NotFoundException('User not found');
    }

    return toUserDto(current, profile);
  }

  /** « J'accepte » the CGU and privacy policy in force (TODO.md Phase 8). */
  @Post('me/terms')
  @HttpCode(200)
  async acceptTerms(@CurrentUser() current: AuthenticatedUser): Promise<UserDto> {
    const updated = await this.users.acceptTerms(current.id);

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    return toUserDto(current, updated);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserDto> {
    const updated = await this.users.updateProfile(current.id, dto);

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    return toUserDto(current, updated);
  }
}
