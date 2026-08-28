import { SetMetadata } from '@nestjs/common';
import { Role } from '../types/role';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to the given roles — enforced by the global `RolesGuard`.
 * A route with no `@Roles()` at all is unaffected (any authenticated caller
 * may access it); this only tightens routes that opt in.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
