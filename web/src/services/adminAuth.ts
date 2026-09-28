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

/**
 * The website's one sign-in: the admin team (back-office) and coiffeurs
 * (their subscription, TODO.md Phase 4). A client account is signed out
 * again — clients only use the app.
 */
export async function signInToSite(email: string, password: string): Promise<"admin" | "coiffeur"> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new AdminAuthError("Identifiants invalides.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError) throw new AdminAuthError(profileError.message);
  if (profile?.role === "admin" || profile?.role === "admin_limited") return "admin";
  if (profile?.role === "coiffeur") return "coiffeur";

  await supabase.auth.signOut();
  throw new AdminAuthError("Cet espace est réservé aux coiffeurs et à l'équipe WorldHair. Utilisez l'application.");
}

export interface CoiffeurSession {
  userId: string;
  email: string;
}

/** A signed-in coiffeur — what the /pro pages need. The real gate is the server's `@Roles('coiffeur')`. */
export async function getCoiffeurSession(): Promise<CoiffeurSession | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "coiffeur" ? { userId: user.id, email: user.email ?? "" } : null;
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
