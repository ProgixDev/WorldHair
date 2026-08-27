import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { EnvironmentVariables } from '../../config/env.validation';
import { UsersService } from '../../users/users.service';
import { AccessTokenPayload } from '../token.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    // Refresh tokens are signed with a different secret, but check anyway.
    if (payload.type !== 'access') {
      throw new UnauthorizedException();
    }

    const user = await this.users.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }

    return { id: user.id, email: user.email, emailVerified: user.emailVerified };
  }
}
