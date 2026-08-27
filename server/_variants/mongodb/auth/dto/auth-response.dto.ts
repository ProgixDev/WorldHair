import { toUserDto, UserDto } from '../../users/dto/user.dto';
import { UserDocument } from '../../users/schemas/user.schema';

export class AuthResponseDto {
  accessToken!: string;
  refreshToken!: string;
  user!: UserDto;
}

export function toAuthResponse(
  user: UserDocument,
  pair: { accessToken: string; refreshToken: string },
): AuthResponseDto {
  return { ...pair, user: toUserDto(user) };
}
