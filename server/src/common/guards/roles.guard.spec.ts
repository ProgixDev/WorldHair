import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../types/authenticated-user';
import { RolesGuard } from './roles.guard';

function fakeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function fakeReflector(required: string[] | undefined): Reflector {
  return { getAllAndOverride: () => required } as unknown as Reflector;
}

const admin: AuthenticatedUser = { id: 'user-1', email: 'admin@example.com', emailVerified: true, role: 'admin' };
const particulier: AuthenticatedUser = {
  id: 'user-2',
  email: 'fan@example.com',
  emailVerified: true,
  role: 'particulier',
};

describe('RolesGuard', () => {
  it('allows any authenticated caller when the route has no @Roles()', () => {
    const guard = new RolesGuard(fakeReflector(undefined));

    expect(guard.canActivate(fakeContext({ user: particulier }))).toBe(true);
  });

  it('allows a caller whose role is in the required list', () => {
    const guard = new RolesGuard(fakeReflector(['admin']));

    expect(guard.canActivate(fakeContext({ user: admin }))).toBe(true);
  });

  it('rejects a caller whose role is not in the required list', () => {
    const guard = new RolesGuard(fakeReflector(['admin']));

    expect(() => guard.canActivate(fakeContext({ user: particulier }))).toThrow(ForbiddenException);
  });

  it('rejects when there is no authenticated user at all', () => {
    const guard = new RolesGuard(fakeReflector(['admin']));

    expect(() => guard.canActivate(fakeContext({}))).toThrow(ForbiddenException);
  });
});
