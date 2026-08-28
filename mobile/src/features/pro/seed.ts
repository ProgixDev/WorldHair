import type { Subscription } from "./types";

/**
 * Demo data for the coiffeur area's still-mock subscription ("Paiements/
 * Abonnements" — no backend yet, see services/pro.ts). Appointments,
 * services and availability are all real now (server/src/appointments/,
 * server/src/salon/) — a fresh coiffeur account simply starts with none of
 * either, same as any other new account.
 */
export function seedSubscription(): Subscription {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);
  const renewsAt = new Date(trialEndsAt);

  return {
    plan: "monthly",
    status: "trial",
    trialEndsAt: trialEndsAt.toISOString(),
    renewsAt: renewsAt.toISOString(),
  };
}
