import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { SupabaseStrategy } from '../strategies/supabase.strategy';

interface RequestWithUser {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
}

/**
 * Named `JwtAuthGuard` — not `SupabaseAuthGuard` — to match the fixed
 * import/class name `app.module.ts` wires up as the global `APP_GUARD`.
 * `app.module.ts` itself never changes between variants (`import {
 * JwtAuthGuard } from './auth/guards/jwt-auth.guard'`), so both variants must
 * export a class of this name at this path even though this one verifies a
 * Supabase-issued token via `SupabaseStrategy.validate()` rather than
 * decoding a locally-signed JWT.
 *
 * Mirrors the mongodb variant's guard behavior exactly: a `@Public()` route
 * skips authentication entirely (no attempt to populate `request.user` even
 * if a token is present); everything else requires a valid bearer token or
 * gets a 401.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly strategy: SupabaseStrategy,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    request.user = await this.strategy.validate(token);
    return true;
  }
}

export function extractBearerToken(request: RequestWithUser): string | undefined {
  const header = request.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
}
