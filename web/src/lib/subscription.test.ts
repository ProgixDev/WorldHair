import {
  describeFormula,
  describeMySubscription,
  describePrice,
  formatEuros,
  formulaLabel,
  landingAfterSignIn,
  priceFor,
  TIER_INFO,
  tierSaving,
  trialSentence,
  yearlySaving,
} from "./subscription";
import type { MySubscription, PlanPrice } from "@/services/proApi";

/** Intl puts no-break spaces around the euro sign: compare with plain ones. */
function plain(text: string | null): string | null {
  return text && text.replace(/\s/g, " ");
}

// What GET /subscriptions/prices answers today.
const PRICES: PlanPrice[] = [
  { tier: "solo", plan: "monthly", amount: 29.99, currency: "eur" },
  { tier: "solo", plan: "yearly", amount: 239.88, currency: "eur" },
  { tier: "team", plan: "monthly", amount: 49.99, currency: "eur" },
  { tier: "team", plan: "yearly", amount: 479.88, currency: "eur" },
];

function subscription(overrides: Partial<MySubscription>): MySubscription {
  return {
    state: "none",
    plan: "monthly",
    tier: "solo",
    teamLimit: 1,
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

describe("tierSaving", () => {
  it("computes what each tier's yearly plan saves against twelve monthly payments", () => {
    // Solo: 12 × 29,99 − 239,88 = 120 € = 4 months; Équipe: 12 × 49,99 − 479,88 = 120 € = 2,4 months.
    expect(tierSaving(PRICES, "solo")).toBe("4 mois offerts");
    expect(tierSaving(PRICES, "team")).toBe("2 mois offerts");
  });

  it("follows the prices it is given", () => {
    const cheaper = PRICES.map((price) =>
      price.tier === "team" && price.plan === "yearly" ? { ...price, amount: 515 } : price,
    );
    expect(tierSaving(cheaper, "team")).toBe("1 mois offert");
  });

  it("says nothing when a price is missing or the yearly plan saves nothing", () => {
    expect(tierSaving(PRICES.filter((price) => price.tier !== "team"), "team")).toBeNull();
    expect(tierSaving(PRICES.filter((price) => price.plan !== "yearly"), "solo")).toBeNull();
    const same = PRICES.map((price) => (price.tier === "solo" && price.plan === "yearly" ? { ...price, amount: 359.88 } : price));
    expect(tierSaving(same, "solo")).toBeNull();
  });
});

describe("yearlySaving rounding", () => {
  it("doesn't lose a whole month to floating point", () => {
    // Nine monthly payments of 29,99 € (269,91 €) are exactly three free months; in floating point it comes to 2,9999….
    expect(yearlySaving(29.99, 269.91)).toBe("3 mois offerts");
    expect(yearlySaving(29.99, 269.92)).toBe("2 mois offerts");
    expect(yearlySaving(9.99, 109.89)).toBe("1 mois offert");
  });
});

describe("TIER_INFO", () => {
  it("names the two formulas", () => {
    expect(TIER_INFO.solo).toEqual({ name: "Solo", tagline: "Vous seul·e dans votre salon" });
    expect(TIER_INFO.team).toEqual({
      name: "Équipe",
      tagline: "Jusqu'à 5 personnes, vous compris : un agenda par coiffeur",
    });
  });
});

describe("formatEuros", () => {
  it("writes euros the French way, cents only when there are some", () => {
    expect(plain(formatEuros(29.99, "eur"))).toBe("29,99 €");
    expect(plain(formatEuros(30, "eur"))).toBe("30 €");
    expect(plain(formatEuros(239.88, "EUR"))).toBe("239,88 €");
  });
});

describe("formulaLabel", () => {
  it("puts a formula and its billing period on one line", () => {
    expect(formulaLabel("team", "yearly")).toBe("Équipe · annuelle");
    expect(formulaLabel("solo", "monthly")).toBe("Solo · mensuelle");
  });

  it("doesn't pretend an offered subscription is billed", () => {
    expect(formulaLabel("team", "monthly", true)).toBe("Équipe · offerte");
  });
});

describe("priceFor", () => {
  it("finds the price of a tier and a billing period", () => {
    expect(priceFor(PRICES, "team", "yearly")?.amount).toBe(479.88);
    expect(priceFor(PRICES, "solo", "monthly")?.amount).toBe(29.99);
    expect(priceFor(null, "solo", "monthly")).toBeUndefined();
    expect(priceFor([], "solo", "monthly")).toBeUndefined();
  });
});

describe("describePrice", () => {
  it("shows a monthly plan as it is billed", () => {
    const display = describePrice(PRICES[0]);
    expect(plain(display.perMonth)).toBe("29,99 €");
    expect(display.billing).toBeNull();
  });

  it("shows a yearly plan per month, with what is billed once a year", () => {
    const solo = describePrice(PRICES[1]);
    expect(plain(solo.perMonth)).toBe("19,99 €");
    expect(plain(solo.billing)).toBe("facturé 239,88 € par an");
    const team = describePrice(PRICES[3]);
    expect(plain(team.perMonth)).toBe("39,99 €");
    expect(plain(team.billing)).toBe("facturé 479,88 € par an");
  });
});

describe("trialSentence", () => {
  it("promises the free days, then the first charge", () => {
    expect(plain(trialSentence(30, PRICES[0]))).toBe("30 jours d'essai gratuit, puis 29,99 € par mois.");
    expect(plain(trialSentence(30, PRICES[3]))).toBe("30 jours d'essai gratuit, puis 479,88 € par an.");
    expect(plain(trialSentence(1, PRICES[0]))).toBe("1 jour d'essai gratuit, puis 29,99 € par mois.");
  });

  it("says nothing without free days", () => {
    expect(trialSentence(0, PRICES[0])).toBe("");
  });
});

describe("describeFormula", () => {
  it("names the formula, the billing period and the team size of a paying salon", () => {
    expect(
      describeFormula(subscription({ state: "active", tier: "team", plan: "yearly", teamLimit: 5 })),
    ).toBe("Formule Équipe · Annuelle · jusqu'à 5 personnes");
    expect(describeFormula(subscription({ state: "trialing", tier: "solo", plan: "monthly", teamLimit: 1 }))).toBe(
      "Formule Solo · Mensuelle · vous seul·e",
    );
  });

  it("leaves the billing period out of an offered subscription, which isn't billed", () => {
    expect(describeFormula(subscription({ state: "active", offered: true, tier: "team", teamLimit: 5 }))).toBe(
      "Formule Équipe · jusqu'à 5 personnes",
    );
  });

  it("has nothing to say before a first subscription", () => {
    expect(describeFormula(subscription({ state: "none" }))).toBeNull();
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
