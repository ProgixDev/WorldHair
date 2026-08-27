import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { SupabaseStrategy } from '../strategies/supabase.strategy';
import { extractBearerToken } from './jwt-auth.guard';

interface RequestWithUser {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
}

/**
 * Populates request.user when a valid bearer token is present, but never
 * rejects. Use on endpoints whose response is richer for signed-in users but
 * must still work for anonymous ones. Same contract as the mongodb variant's
 * guard of the same name.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly strategy: SupabaseStrategy) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = extractBearerToken(request);

    if (token) {
      try {
        request.user = await this.strategy.validate(token);
      } catch {
        // Invalid/expired token on an optional route: proceed anonymously.
      }
    }

    return true;
  }
}
