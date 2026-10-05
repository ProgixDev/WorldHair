import {
  countBookingsAfterEnd,
  daysRemaining,
  describeSubscription,
  isNearingExpiry,
  isSubscriptionExpired,
} from "./subscription";
import type { ProAppointment, Subscription } from "./types";

const NOW = new Date("2026-10-01T10:00:00.000Z");
const inDays = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();

function subscription(overrides: Partial<Subscription>): Subscription {
  return {
    state: "active",
    plan: "monthly",
    tier: "solo",
    teamLimit: 1,
    listed: true,
    offered: false,
    trialEndsAt: null,
    currentPeriodEnd: inDays(20),
    endsAt: null,
    ...overrides,
  };
}

describe("subscription", () => {
  it("counts the days left before the salon leaves search, when it will", () => {
    expect(daysRemaining(subscription({ state: "ending", endsAt: inDays(5) }), NOW)).toBe(5);
    expect(daysRemaining(subscription({ state: "active" }), NOW)).toBeNull();
  });

  it("warns during the last week only", () => {
    expect(isNearingExpiry(subscription({ state: "ending", endsAt: inDays(7) }), NOW)).toBe(true);
    expect(isNearingExpiry(subscription({ state: "ending", endsAt: inDays(12) }), NOW)).toBe(false);
    expect(isNearingExpiry(subscription({ state: "active" }), NOW)).toBe(false);
  });

  it("blocks the pro area once the subscription has ended, not before the first one", () => {
    expect(isSubscriptionExpired(subscription({ state: "expired", listed: false }))).toBe(true);
    expect(isSubscriptionExpired(subscription({ state: "none", listed: false }))).toBe(false);
  });

  it("counts the bookings still set after the end date", () => {
    const booking = (startsAt: string, status: ProAppointment["status"]) =>
      ({ id: startsAt + status, startsAt, status }) as ProAppointment;
    const ending = subscription({ state: "ending", endsAt: inDays(10) });
    const appointments = [
      booking(inDays(5), "confirmed"),
      booking(inDays(12), "confirmed"),
      booking(inDays(15), "pending"),
      booking(inDays(20), "cancelled"),
    ];

    expect(countBookingsAfterEnd(ending, appointments)).toBe(2);
    expect(countBookingsAfterEnd(subscription({ state: "active" }), appointments)).toBe(0);
  });

  describe("describeSubscription", () => {
    it("tells a new salon it isn't online yet", () => {
      expect(describeSubscription(subscription({ state: "none", listed: false }), NOW)).toMatchObject({
        title: "Fiche pas encore en ligne",
        tone: "warning",
      });
    });

    it("reads a running subscription calmly, with its next date", () => {
      const trial = describeSubscription(subscription({ state: "trialing", trialEndsAt: inDays(20) }), NOW);
      expect(trial).toMatchObject({ title: "Essai gratuit", tone: "ok" });
      expect(trial.detail).toMatch(/premier prélèvement/);

      expect(describeSubscription(subscription({ state: "active" }), NOW)).toMatchObject({
        title: "Abonnement actif",
        tone: "ok",
      });
      expect(
        describeSubscription(subscription({ state: "active", offered: true, endsAt: inDays(200) }), NOW),
      ).toMatchObject({ title: "Abonnement offert", tone: "ok" });
    });

    it("counts down the last week before a scheduled end", () => {
      expect(describeSubscription(subscription({ state: "ending", endsAt: inDays(3) }), NOW)).toMatchObject({
        title: "Il vous reste 3 jours d'abonnement",
        tone: "danger",
      });
      expect(describeSubscription(subscription({ state: "ending", endsAt: inDays(1) }), NOW).title).toBe(
        "Il vous reste 1 jour d'abonnement",
      );
      expect(describeSubscription(subscription({ state: "ending", endsAt: inDays(30) }), NOW)).toMatchObject({
        title: "Abonnement résilié",
        tone: "warning",
      });
    });

    it("warns about bookings left after a scheduled end", () => {
      const ending = subscription({ state: "ending", endsAt: inDays(30) });
      expect(describeSubscription(ending, NOW, { bookingsAfterEnd: 2 }).detail).toMatch(
        /2 rendez-vous sont prévus après cette date/,
      );
      expect(describeSubscription(ending, NOW, { bookingsAfterEnd: 0 }).detail).not.toMatch(/rendez-vous/);
    });

    it("never points to paying outside the app (App Store rule 3.1.3)", () => {
      for (const state of ["none", "trialing", "active", "ending", "past_due", "incomplete", "expired"] as const) {
        const { detail } = describeSubscription(subscription({ state, endsAt: inDays(3) }), NOW);
        expect(detail).not.toMatch(/email|site|lien|carte/i);
      }
    });

    it("flags a refused payment and an ended subscription", () => {
      expect(describeSubscription(subscription({ state: "past_due" }), NOW)).toMatchObject({
        title: "Paiement refusé",
        tone: "danger",
      });
      expect(describeSubscription(subscription({ state: "incomplete", listed: false }), NOW)).toMatchObject({
        title: "Paiement en attente",
        tone: "warning",
      });
      expect(describeSubscription(subscription({ state: "expired", listed: false }), NOW)).toMatchObject({
        title: "Abonnement terminé",
        tone: "danger",
      });
    });
  });
});
