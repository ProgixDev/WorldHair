import { AxiosError, AxiosHeaders } from "axios";
import {
  closuresOf,
  inviteLink,
  inviteShareMessage,
  inviteValidity,
  memberName,
  nobodyElseTakesBookings,
  removeStaffRefusal,
  sameWeek,
  teamSizeLabel,
  weekSummary,
  weekToEdit,
} from "./team";
import type { AvailabilityDay, StaffMember, TimeOff } from "./types";

function day(weekday: number, open: boolean, opens = 9 * 60, closes = 19 * 60): AvailabilityDay {
  return { weekday, open, opens, closes, breakStart: null, breakEnd: null };
}

/** Sunday first, like the server sends it. */
function week(openDays: number[], opens?: number, closes?: number): AvailabilityDay[] {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => day(weekday, openDays.includes(weekday), opens, closes));
}

function member(overrides: Partial<StaffMember> = {}): StaffMember {
  return {
    id: "sofia",
    profileId: "p-sofia",
    firstName: "Sofia",
    lastName: "Benali",
    photoUrl: null,
    isOwner: false,
    takesBookings: true,
    position: 1,
    availability: null,
    ...overrides,
  };
}

function refused(status: number, message: string): AxiosError {
  const headers = new AxiosHeaders();
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers,
    config: { headers },
    data: { message },
  });
}

describe("memberName", () => {
  it("joins first and last name, and never leaves a blank line", () => {
    expect(memberName(member())).toBe("Sofia Benali");
    expect(memberName(member({ lastName: "" }))).toBe("Sofia");
    expect(memberName(member({ firstName: "", lastName: "" }))).toBe("Sans nom");
  });
});

describe("weekSummary", () => {
  it("says a person without their own week follows the salon's hours", () => {
    expect(weekSummary(null)).toBe("Horaires du salon");
  });

  it("names a run of days by its first and last, Monday first, with the shared hours", () => {
    expect(weekSummary(week([2, 3, 4, 5, 6]))).toBe("Mar.–sam. · 09:00–19:00");
    expect(weekSummary(week([0, 1, 2, 3, 4, 5, 6], 10 * 60, 18 * 60))).toBe("Lun.–dim. · 10:00–18:00");
  });

  it("lists scattered days one by one, and two days in a row too", () => {
    expect(weekSummary(week([1, 3, 5]))).toBe("Lun., mer., ven. · 09:00–19:00");
    expect(weekSummary(week([1, 2, 4, 5, 6]))).toBe("Lun., mar., jeu.–sam. · 09:00–19:00");
  });

  it("says the hours vary when the days don't share them", () => {
    const days = week([1, 2, 3, 4, 5]).map((item) => (item.weekday === 3 ? { ...item, closes: 13 * 60 } : item));
    expect(weekSummary(days)).toBe("Lun.–ven. · horaires variables");
  });

  it("says when the person works no day at all", () => {
    expect(weekSummary(week([]))).toBe("Aucun jour travaillé");
  });
});

describe("weekToEdit", () => {
  it("starts a new personal week from a copy of the salon's", () => {
    const salon = week([2, 3, 4, 5, 6]);
    const draft = weekToEdit(null, salon);
    expect(draft).toEqual(salon);
    expect(draft[0]).not.toBe(salon[0]);
  });

  it("keeps the person's own days, in the salon's order, filling any missing one from the salon", () => {
    const salon = week([2, 3, 4, 5, 6]);
    const own = [day(6, false), day(1, true, 8 * 60, 16 * 60)];
    expect(weekToEdit(own, salon)).toEqual([
      day(0, false),
      day(1, true, 8 * 60, 16 * 60),
      day(2, true),
      day(3, true),
      day(4, true),
      day(5, true),
      day(6, false),
    ]);
  });
});

describe("sameWeek", () => {
  it("compares day by day, whatever the order", () => {
    const own = week([1, 2, 3]);
    expect(sameWeek([...own].reverse(), own)).toBe(true);
    expect(sameWeek(own.map((item) => (item.weekday === 2 ? { ...item, opens: 10 * 60 } : item)), own)).toBe(false);
  });

  it("counts a first personal week as a change", () => {
    expect(sameWeek(week([1, 2, 3]), null)).toBe(false);
  });
});

describe("teamSizeLabel", () => {
  it("counts the team, the owner included", () => {
    expect(teamSizeLabel([])).toBe("Vous seul");
    expect(teamSizeLabel([member({ id: "owner", isOwner: true })])).toBe("Vous seul");
    expect(teamSizeLabel([member({ id: "owner", isOwner: true }), member(), member({ id: "nadia" })])).toBe(
      "3 personnes",
    );
  });
});

describe("nobodyElseTakesBookings", () => {
  it("warns when switching this person off would leave no one for the clients' bookings", () => {
    const owner = member({ id: "owner", isOwner: true });
    expect(nobodyElseTakesBookings([owner, member({ takesBookings: false })], "owner")).toBe(true);
    expect(nobodyElseTakesBookings([owner], "owner")).toBe(true);
    expect(nobodyElseTakesBookings([owner, member()], "owner")).toBe(false);
  });
});

describe("closuresOf", () => {
  const closure = (id: string, staffId: string | null): TimeOff => ({
    id,
    staffId,
    label: "",
    startsAt: new Date(2026, 9, 6).toISOString(),
    endsAt: new Date(2026, 9, 7).toISOString(),
  });
  const timeOff = [closure("salon", null), closure("sofia-1", "sofia"), closure("nadia-1", "nadia")];

  it("keeps one person's congés", () => {
    expect(closuresOf(timeOff, "sofia").map((item) => item.id)).toEqual(["sofia-1"]);
  });

  it("keeps the whole salon's closures without a person", () => {
    expect(closuresOf(timeOff, null).map((item) => item.id)).toEqual(["salon"]);
  });
});

describe("invites", () => {
  const invite = {
    code: "ABC234",
    expiresAt: new Date(2026, 9, 12, 14, 32).toISOString(),
    createdAt: new Date(2026, 9, 5, 14, 32).toISOString(),
  };

  it("says until when a code works", () => {
    expect(inviteValidity(invite.expiresAt)).toBe("Valable jusqu'au lundi 12 oct. à 14:32");
  });

  it("writes the message the owner sends, with the code and how to use it", () => {
    expect(inviteShareMessage("Maison Tresse", invite, "https://worldhair.test")).toBe(
      "Rejoignez Maison Tresse sur WorldHair : ouvrez https://worldhair.test/rejoindre/ABC234 , ou dans l'app choisissez « Coiffeur › Rejoindre un salon » et entrez le code ABC234 (valable jusqu'au lundi 12 oct. à 14:32).",
    );
    expect(inviteShareMessage("  ", invite, "https://worldhair.test")).toContain("Rejoignez mon salon sur WorldHair");
    // No website address in this build: the code alone.
    expect(inviteShareMessage("Maison Tresse", invite, "")).toBe(
      "Rejoignez Maison Tresse sur WorldHair : téléchargez l'app, choisissez « Coiffeur › Rejoindre un salon » et entrez le code ABC234 (valable jusqu'au lundi 12 oct. à 14:32).",
    );
  });

  it("links to the website's « /rejoindre » page, which opens the app with the code in", () => {
    expect(inviteLink("ABC234", "https://worldhair.test/")).toBe("https://worldhair.test/rejoindre/ABC234");
    expect(inviteLink("ABC234", undefined)).toBeNull();
  });
});

describe("removeStaffRefusal", () => {
  it("explains why someone with bookings to come can't be removed yet", () => {
    expect(
      removeStaffRefusal(refused(409, "STAFF_HAS_BOOKINGS: reassign or cancel their bookings to come first")),
    ).toBe("Des rendez-vous à venir lui sont attribués : donnez-les à quelqu'un d'autre depuis l'agenda, puis réessayez.");
  });

  it("explains the owner stays in his own team", () => {
    expect(removeStaffRefusal(refused(400, "A salon's owner can't be removed from its team"))).toBe(
      "Le propriétaire du salon ne peut pas être retiré de l'équipe.",
    );
  });

  it("leaves any other failure to the generic message", () => {
    expect(removeStaffRefusal(refused(404, "Staff member not found"))).toBeNull();
    expect(removeStaffRefusal(new Error("network down"))).toBeNull();
  });
});
