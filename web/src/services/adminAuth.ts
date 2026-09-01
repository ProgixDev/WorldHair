import { supabase } from "@/lib/supabase";

export class AdminAuthError extends Error {}

export interface AdminSession {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}

/** `profiles.role !== 'admin'` is checked here, client-side — the real gate
 * is still server-side (`@Roles('admin')`, server/src/common/guards/
 * roles.guard.ts); this only decides whether the web UI shows the page. */
async function requireAdminRole(userId: string): Promise<{ firstName: string; lastName: string }> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, first_name, last_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new AdminAuthError(error.message);
  if (profile?.role !== "admin") {
    await supabase.auth.signOut();
    throw new AdminAuthError("Ce compte n'a pas les droits administrateur.");
  }
  return { firstName: profile.first_name ?? "", lastName: profile.last_name ?? "" };
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
    const { firstName, lastName } = await requireAdminRole(user.id);
    return { userId: user.id, email: user.email ?? "", firstName, lastName };
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
