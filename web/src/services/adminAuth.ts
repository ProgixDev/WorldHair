import { supabase } from "@/lib/supabase";

export class AdminAuthError extends Error {}

export type AdminTier = "admin" | "admin_limited";

export interface AdminSession {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  /** "admin" is the full/super tier; "admin_limited" has every admin capability except creating more admins. */
  tier: AdminTier;
}

/** `profiles.role !== 'admin' | 'admin_limited'` is checked here, client-side
 * — the real gate is still server-side (`@Roles('admin', 'admin_limited')`,
 * server/src/common/guards/roles.guard.ts); this only decides whether the
 * web UI shows the page. */
async function requireAdminRole(
  userId: string,
): Promise<{ firstName: string; lastName: string; tier: AdminTier }> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, first_name, last_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new AdminAuthError(error.message);
  if (profile?.role !== "admin" && profile?.role !== "admin_limited") {
    await supabase.auth.signOut();
    throw new AdminAuthError("Ce compte n'a pas les droits administrateur.");
  }
  return {
    firstName: profile.first_name ?? "",
    lastName: profile.last_name ?? "",
    tier: profile.role,
  };
}

export async function signInAdmin(email: string, password: string): Promise<void> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new AdminAuthError("Identifiants invalides.");
  if (!data.user) throw new AdminAuthError("Identifiants invalides.");

  await requireAdminRole(data.user.id);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;

  try {
    const { firstName, lastName, tier } = await requireAdminRole(user.id);
    return { userId: user.id, email: user.email ?? "", firstName, lastName, tier };
  } catch {
    return null;
  }
}

export async function signOutAdmin(): Promise<void> {
  await supabase.auth.signOut();
}

/** Supabase sends a confirmation link to the new address before the change takes effect. */
export async function updateAdminEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw new AdminAuthError(error.message);
}

export async function updateAdminPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new AdminAuthError(error.message);
}
