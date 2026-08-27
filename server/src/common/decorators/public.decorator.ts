import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a route out of the global JwtAuthGuard.
 *
 * Class-level `@Public()` cannot be overridden by a method-level guard — the
 * guard checks method metadata first, then falls back to class metadata, but
 * there is no `@Guarded()`/false counterpart. If a controller needs a mix of
 * public and protected routes, apply `@Public()` per-route instead of at the
 * class level (see AuthController, which does this specifically because
 * `logout` must stay protected while its other routes are public).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
