import {
  daysRemaining,
  describeSubscription,
  isNearingExpiry,
  isSubscriptionExpired,
} from "./subscription";
import type { Subscription } from "./types";

const NOW = new Date("2026-10-01T10:00:00.000Z");
const inDays = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();

function subscription(overrides: Partial<Subscription>): Subscription {
  return {
    state: "active",
    plan: "monthly",
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
