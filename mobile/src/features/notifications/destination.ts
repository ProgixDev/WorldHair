/**
 * Where tapping a push lands. Most are about an appointment — no
 * single-appointment screen to deep-link into yet, so the role's agenda —
 * and the server tags subscription news with `screen: "subscription"`.
 */
export function notificationDestination(
  role: string | undefined,
  data: Record<string, unknown> | undefined,
): string {
  if (role === "coiffeur") {
    return data?.screen === "subscription" ? "/pro/account" : "/pro/agenda";
  }
  return "/appointments";
}
