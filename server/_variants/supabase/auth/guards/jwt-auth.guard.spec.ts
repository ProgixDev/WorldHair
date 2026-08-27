import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { SupabaseStrategy } from '../strategies/supabase.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';

function fakeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function fakeReflector(isPublic: boolean): Reflector {
  return { getAllAndOverride: () => isPublic } as unknown as Reflector;
}

const user: AuthenticatedUser = { id: 'user-1', email: 'fan@example.com', emailVerified: true };

describe('JwtAuthGuard (supabase)', () => {
  it('lets a @Public() route through without checking for a token', async () => {
    const strategy = { validate: jest.fn() } as unknown as SupabaseStrategy;
    const guard = new JwtAuthGuard(fakeReflector(true), strategy);
    const request: Record<string, unknown> = { headers: {} };

    await expect(guard.canActivate(fakeContext(request))).resolves.toBe(true);
    expect(strategy.validate).not.toHaveBeenCalled();
    expect(request.user).toBeUndefined();
  });

  it('rejects a protected route with no Authorization header', async () => {
    const strategy = { validate: jest.fn() } as unknown as SupabaseStrategy;
    const guard = new JwtAuthGuard(fakeReflector(false), strategy);

    await expect(guard.canActivate(fakeContext({ headers: {} }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('attaches the resolved user and allows a protected route with a valid token', async () => {
    const strategy = { validate: jest.fn().mockResolvedValue(user) } as unknown as SupabaseStrategy;
    const guard = new JwtAuthGuard(fakeReflector(false), strategy);
    const request: Record<string, unknown> = { headers: { authorization: 'Bearer good-token' } };

    await expect(guard.canActivate(fakeContext(request))).resolves.toBe(true);
    expect(strategy.validate).toHaveBeenCalledWith('good-token');
    expect(request.user).toEqual(user);
  });

  it('propagates the strategy rejection for an invalid token', async () => {
    const strategy = {
      validate: jest.fn().mockRejectedValue(new UnauthorizedException()),
    } as unknown as SupabaseStrategy;
    const guard = new JwtAuthGuard(fakeReflector(false), strategy);
    const request = { headers: { authorization: 'Bearer bad-token' } };

    await expect(guard.canActivate(fakeContext(request))).rejects.toThrow(UnauthorizedException);
  });
});
