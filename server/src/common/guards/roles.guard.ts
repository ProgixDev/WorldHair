import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../types/authenticated-user';
import { Role } from '../types/role';

interface RequestWithUser {
  user?: AuthenticatedUser;
}

/**
 * Wired in as a global `APP_GUARD` (see `app.module.ts`), after `JwtAuthGuard`
 * so `request.user` is already populated — this guard only reads it, it never
 * verifies a token itself. A route without `@Roles()` metadata passes through
 * unchanged; this is deliberately global rather than per-controller so a
 * forgotten `@UseGuards(RolesGuard)` can never leave an admin/coiffeur-only
 * route unprotected.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const role = request.user?.role;

    if (!role || !required.includes(role)) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
