export type AdminTier = 'admin' | 'admin_limited';

/** One row in the "Gestion des admins" list on `/admin/parametres`. */
export class AdminUserDto {
  id!: string;
  email!: string;
  tier!: AdminTier;
  createdAt!: string;
}
