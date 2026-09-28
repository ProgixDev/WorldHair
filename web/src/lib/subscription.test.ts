import { describeMySubscription, landingAfterSignIn, yearlySaving } from "./subscription";
import type { MySubscription } from "@/services/proApi";

function subscription(overrides: Partial<MySubscription>): MySubscription {
  return {
    state: "none",
    plan: "monthly",
    listed: false,
    offered: false,
    trialEndsAt: null,
    currentPeriodEnd: null,
    endsAt: null,
    canManage: false,
    awaitingValidation: false,
    canSubscribe: true,
    trialDays: 30,
    ...overrides,
  };
}

describe("describeMySubscription", () => {
  it("invites a salon that never subscribed", () => {
    expect(describeMySubscription(subscription({}))).toMatchObject({
      title: "Votre salon n'est pas encore en ligne",
      tone: "warning",
    });
  });

  it("tells a coiffeur still awaiting validation that subscribing comes after", () => {
    expect(
      describeMySubscription(subscription({ awaitingValidation: true, canSubscribe: false })),
    ).toMatchObject({ title: "Dossier en cours de validation", tone: "warning" });
  });

  it("gives the date that matters for a running subscription", () => {
    const trial = describeMySubscription(
      subscription({ state: "trialing", listed: true, trialEndsAt: "2026-10-31T10:00:00.000Z" }),
    );
    expect(trial.title).toBe("Essai gratuit en cours");
    expect(trial.detail).toContain("31 octobre 2026");

    const ending = describeMySubscription(
      subscription({ state: "ending", listed: true, endsAt: "2026-11-15T10:00:00.000Z" }),
    );
    expect(ending).toMatchObject({ title: "Abonnement résilié", tone: "warning" });
    expect(ending.detail).toContain("15 novembre 2026");
  });

  it("tells an offered salon that subscribing now keeps its free period", () => {
    const offered = describeMySubscription(
      subscription({ state: "active", offered: true, listed: true, endsAt: "2027-09-30T10:00:00.000Z" }),
    );
    expect(offered.title).toBe("Abonnement offert");
    expect(offered.detail).toContain("30 septembre 2027");
    expect(offered.detail).toMatch(/conservée/);
  });

  it("says when a paid-up salon still isn't visible because its page isn't finished", () => {
    const detail = describeMySubscription(subscription({ state: "active", listed: false, currentPeriodEnd: "2026-11-01T10:00:00.000Z" })).detail;
    expect(detail).toMatch(/pas encore visible/);
  });

  it("flags a refused payment and an ended subscription", () => {
    expect(describeMySubscription(subscription({ state: "past_due", listed: true })).tone).toBe("danger");
    expect(describeMySubscription(subscription({ state: "expired" }))).toMatchObject({
      title: "Abonnement terminé",
      tone: "danger",
    });
  });
});

describe("yearlySaving", () => {
  it("counts the months the yearly plan saves", () => {
    expect(yearlySaving(19, 182)).toBe("2 mois offerts");
    expect(yearlySaving(19, 205)).toBe("1 mois offert");
    expect(yearlySaving(19, 228)).toBeNull();
  });
});

describe("landingAfterSignIn", () => {
  it("sends an admin to the back-office and a coiffeur to their subscription", () => {
    expect(landingAfterSignIn("admin", null)).toBe("/admin");
    expect(landingAfterSignIn("coiffeur", null)).toBe("/pro/abonnement");
  });

  it("follows a coiffeur's link back into the pro area only", () => {
    expect(landingAfterSignIn("coiffeur", "/pro/abonnement?checkout=success")).toBe(
      "/pro/abonnement?checkout=success",
    );
    expect(landingAfterSignIn("coiffeur", "https://evil.example")).toBe("/pro/abonnement");
    expect(landingAfterSignIn("coiffeur", "/admin")).toBe("/pro/abonnement");
  });

  it("can't be walked out of the pro area with dot segments", () => {
    expect(landingAfterSignIn("coiffeur", "/pro/..//evil.example")).toBe("/pro/abonnement");
    expect(landingAfterSignIn("coiffeur", "/pro/%2e%2e//evil.example")).toBe("/pro/abonnement");
    expect(landingAfterSignIn("coiffeur", "//evil.example/pro/x")).toBe("/pro/abonnement");
  });
});
