import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

/**
 * Populates request.user when a valid token is present, but never rejects.
 * Use on endpoints whose response is richer for signed-in users but must
 * still work for anonymous ones.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context) as boolean | Promise<boolean>;
  }

  handleRequest<TUser = AuthenticatedUser>(_err: unknown, user: TUser | false): TUser {
    return (user || undefined) as TUser;
  }
}
