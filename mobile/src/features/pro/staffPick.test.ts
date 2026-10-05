import { defaultPick, personDay, personOf, staffLabel } from "./staffPick";
import type { AvailabilityDay, StaffCandidate } from "./types";

function candidate(overrides: Partial<StaffCandidate>): StaffCandidate {
  return {
    staffId: "sofia",
    firstName: "Sofia",
    lastName: "Benali",
    photoUrl: null,
    isOwner: false,
    free: true,
    held: false,
    ...overrides,
  };
}

describe("defaultPick", () => {
  it("keeps the person the booking has when they're free", () => {
    expect(
      defaultPick([candidate({ staffId: "sofia" }), candidate({ staffId: "nadia", held: true })]),
    ).toBe("nadia");
  });

  it("falls back to the first person free, and to nobody when no one is", () => {
    expect(
      defaultPick([
        candidate({ staffId: "sofia", free: false, held: true }),
        candidate({ staffId: "nadia" }),
      ]),
    ).toBe("nadia");
    expect(defaultPick([candidate({ free: false })])).toBeNull();
  });
});

describe("staffLabel", () => {
  it("names the owner as himself", () => {
    expect(staffLabel(candidate({ isOwner: true }))).toBe("Moi (Sofia Benali)");
    expect(staffLabel(candidate({}))).toBe("Sofia Benali");
    expect(staffLabel(candidate({ firstName: "", lastName: "" }))).toBe("Sans nom");
  });
});

describe("personDay", () => {
  const salon: AvailabilityDay = { weekday: 3, open: true, opens: 540, closes: 1140, breakStart: 780, breakEnd: 840 };

  it("is the salon's day for someone on the salon's hours", () => {
    expect(personDay(salon, null, 3)).toEqual(salon);
    expect(personDay(undefined, null, 3)).toBeUndefined();
  });

  it("keeps a person's own hours inside the salon's, with their own break", () => {
    const own: AvailabilityDay[] = [{ weekday: 3, open: true, opens: 480, closes: 1020, breakStart: null, breakEnd: null }];
    expect(personDay(salon, own, 3)).toEqual({ weekday: 3, open: true, opens: 540, closes: 1020, breakStart: 780, breakEnd: 840 });

    const ownBreak: AvailabilityDay[] = [{ weekday: 3, open: true, opens: 600, closes: 1080, breakStart: 720, breakEnd: 750 }];
    expect(personDay(salon, ownBreak, 3)).toMatchObject({ opens: 600, closes: 1080, breakStart: 720, breakEnd: 750 });
  });

  it("is closed on a day they don't work", () => {
    expect(personDay(salon, [{ ...salon, open: false }], 3)?.open).toBe(false);
    expect(personDay(salon, [], 3)?.open).toBe(false);
  });
});

describe("personOf", () => {
  it("gives a booking without a person to the owner, as the server does", () => {
    expect(personOf({ staffId: "nadia" }, "sofia")).toBe("nadia");
    expect(personOf({ staffId: null }, "sofia")).toBe("sofia");
  });
});
