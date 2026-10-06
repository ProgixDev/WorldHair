import {
  canShowCompletionCode,
  codeRefreshDelayMs,
  codeValidityLabel,
  confirmedLabel,
  presenceLink,
} from "./presence";
import type { ProAppointment } from "./types";

const NOW = new Date(2026, 9, 5, 15, 0); // Monday 5 October 2026, 15:00 local
const HOUR = 3_600_000;

function booking(overrides: Partial<ProAppointment> = {}): ProAppointment {
  return {
    id: "a1",
    serviceId: "svc1",
    clientName: "Camille Durand",
    clientId: "c1",
    // Started 30 minutes ago, lasts 45.
    startsAt: new Date(NOW.getTime() - 30 * 60_000).toISOString(),
    durationMin: 45,
    price: 40,
    services: [{ serviceId: "svc1", name: "Coupe", price: 40, durationMin: 45 }],
    status: "confirmed",
    attendance: null,
    isNewClient: false,
    payment: null,
    staffId: "s1",
    staffName: "Léa Martin",
    confirmedByClientAt: null,
    ...overrides,
  };
}

describe("presenceLink", () => {
  it("links to the website's « /rdv » page, which hands over to the app with the code in", () => {
    expect(presenceLink("ABCDEFGHJKMN", "https://worldhair.test")).toBe("https://worldhair.test/rdv/ABCDEFGHJKMN");
  });

  it("copes with a trailing slash or stray spaces in the configured address", () => {
    expect(presenceLink("ABCDEFGHJKMN", " https://worldhair.test// ")).toBe("https://worldhair.test/rdv/ABCDEFGHJKMN");
  });

  it("is null when this build has no website address", () => {
    expect(presenceLink("ABCDEFGHJKMN", undefined)).toBeNull();
    expect(presenceLink("ABCDEFGHJKMN", "  ")).toBeNull();
  });
});

describe("codeRefreshDelayMs", () => {
  it("asks for a new code when about a minute remains", () => {
    const expiresAt = new Date(NOW.getTime() + 5 * 60_000).toISOString();
    expect(codeRefreshDelayMs(expiresAt, NOW)).toBe(4 * 60_000);
  });

  it("never returns zero or less, even for a code about to expire or already expired", () => {
    expect(codeRefreshDelayMs(new Date(NOW.getTime() + 30_000).toISOString(), NOW)).toBeGreaterThan(0);
    expect(codeRefreshDelayMs(new Date(NOW.getTime() - 60_000).toISOString(), NOW)).toBeGreaterThan(0);
    expect(codeRefreshDelayMs("not a date", NOW)).toBeGreaterThan(0);
  });
});

describe("codeValidityLabel", () => {
  it("rounds up to whole minutes, so a code never reads « 0 min » while it still works", () => {
    expect(codeValidityLabel(new Date(NOW.getTime() + 4 * 60_000 + 20_000).toISOString(), NOW)).toBe(
      "Valable encore 5 min",
    );
    expect(codeValidityLabel(new Date(NOW.getTime() + 20_000).toISOString(), NOW)).toBe("Valable encore 1 min");
    expect(codeValidityLabel(new Date(NOW.getTime() - 5_000).toISOString(), NOW)).toBe("Valable encore 1 min");
  });
});

describe("canShowCompletionCode", () => {
  it("is true for an accepted booking in progress", () => {
    expect(canShowCompletionCode(booking(), NOW)).toBe(true);
  });

  it("is true once the booking is over (the list then calls it « done »), up to 12 hours after its end", () => {
    const endedTwoHoursAgo = booking({
      status: "done",
      startsAt: new Date(NOW.getTime() - 2 * HOUR - 45 * 60_000).toISOString(),
    });
    expect(canShowCompletionCode(endedTwoHoursAgo, NOW)).toBe(true);

    const endedJustWithinWindow = booking({
      status: "done",
      startsAt: new Date(NOW.getTime() - 12 * HOUR - 45 * 60_000 + 60_000).toISOString(),
    });
    expect(canShowCompletionCode(endedJustWithinWindow, NOW)).toBe(true);
  });

  it("is false more than 12 hours after the end", () => {
    const tooOld = booking({
      status: "done",
      startsAt: new Date(NOW.getTime() - 12 * HOUR - 45 * 60_000 - 60_000).toISOString(),
    });
    expect(canShowCompletionCode(tooOld, NOW)).toBe(false);
  });

  it("is false before the booking starts", () => {
    const later = booking({ startsAt: new Date(NOW.getTime() + 60_000).toISOString() });
    expect(canShowCompletionCode(later, NOW)).toBe(false);
  });

  it("is false for a booking that isn't accepted", () => {
    for (const status of ["pending", "refused", "cancelled"] as const) {
      expect(canShowCompletionCode(booking({ status }), NOW)).toBe(false);
    }
  });

  it("is false for an absent client, and once the client has confirmed", () => {
    expect(canShowCompletionCode(booking({ attendance: "no_show" }), NOW)).toBe(false);
    expect(canShowCompletionCode(booking({ confirmedByClientAt: NOW.toISOString() }), NOW)).toBe(false);
  });

  it("stays true after a manual « Honoré »: the code is still proof the client was there", () => {
    expect(canShowCompletionCode(booking({ attendance: "attended" }), NOW)).toBe(true);
  });
});

describe("confirmedLabel", () => {
  it("says the client confirmed, with the day and time", () => {
    expect(confirmedLabel(new Date(2026, 9, 5, 14, 32).toISOString(), NOW)).toBe(
      "Confirmé par le client · Aujourd'hui à 14:32",
    );
    expect(confirmedLabel(new Date(2026, 9, 3, 9, 5).toISOString(), NOW)).toBe(
      "Confirmé par le client · sam. 3 oct. à 09:05",
    );
  });
});
