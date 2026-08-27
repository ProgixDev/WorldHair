import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { toUserDto, UserDto } from './dto/user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() current: AuthenticatedUser): Promise<UserDto> {
    const user = await this.users.findById(current.id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return toUserDto(user);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserDto> {
    const updated = await this.users.update(current.id, dto);

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    return toUserDto(updated);
  }
}
