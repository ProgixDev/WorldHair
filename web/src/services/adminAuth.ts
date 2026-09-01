import { supabase } from "@/lib/supabase";

export class AdminAuthError extends Error {}

export interface AdminSession {
  userId: string;
  email: string;
}

/** `profiles.role !== 'admin'` is checked here, client-side — the real gate
 * is still server-side (`@Roles('admin')`, server/src/common/guards/
 * roles.guard.ts); this only decides whether the web UI shows the page. */
async function requireAdminRole(userId: string): Promise<void> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new AdminAuthError(error.message);
  if (profile?.role !== "admin") {
    await supabase.auth.signOut();
    throw new AdminAuthError("Ce compte n'a pas les droits administrateur.");
  }
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
    await requireAdminRole(user.id);
  } catch {
    return null;
  }

  return { userId: user.id, email: user.email ?? "" };
}

export async function signOutAdmin(): Promise<void> {
  await supabase.auth.signOut();
}
