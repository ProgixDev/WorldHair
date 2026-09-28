import { bookingRuleLines, formatNotice } from "./rules";

describe("formatNotice", () => {
  it("reads like the presets the coiffeur picks from", () => {
    expect(formatNotice(30)).toBe("30 min");
    expect(formatNotice(60)).toBe("1 h");
    expect(formatNotice(720)).toBe("12 h");
    expect(formatNotice(1440)).toBe("1 jour");
    expect(formatNotice(2880)).toBe("2 jours");
  });
});

describe("bookingRuleLines", () => {
  it("states both deadlines and how the booking gets confirmed", () => {
    expect(
      bookingRuleLines({ bookingNoticeMinutes: 60, cancellationNoticeMinutes: 1440, confirmationMode: "manual" }),
    ).toEqual([
      "Réservable jusqu'à 1 h avant",
      "Annulation ou modification jusqu'à 1 jour avant",
      "Le salon confirme chaque demande",
    ]);
  });

  it("says when there's no deadline at all", () => {
    expect(
      bookingRuleLines({ bookingNoticeMinutes: 0, cancellationNoticeMinutes: 0, confirmationMode: "instant" }),
    ).toEqual([
      "Réservable jusqu'au dernier moment",
      "Annulation ou modification à tout moment",
      "Confirmation immédiate",
    ]);
  });
});
