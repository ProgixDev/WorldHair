import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * The subset of the request this guard reads.
 *
 * Declared rather than typed as `Record<string, any>`: naming the fields is
 * what makes `req.user.id` a checked access rather than a silent typo waiting
 * to throttle everyone into one shared IP bucket.
 */
interface ThrottledRequest {
  user?: AuthenticatedUser;
  ips?: string[];
  ip?: string;
}

/**
 * Buckets an authenticated caller by user id instead of IP, so many users
 * behind one NAT/proxy don't share a single rate-limit bucket. Falls back to
 * IP for anonymous requests. Wire in as the global `APP_GUARD` for
 * `ThrottlerModule` in place of its default guard.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: ThrottledRequest): Promise<string> {
    if (req.user?.id) {
      return Promise.resolve(req.user.id);
    }

    // Fall back to the IP. `ips` is populated only behind a trusted proxy, in
    // which case its first entry is the real client; `ip` is the direct peer.
    const tracker = req.ips?.length ? req.ips[0] : req.ip;
    return Promise.resolve(tracker ?? 'unknown');
  }
}
