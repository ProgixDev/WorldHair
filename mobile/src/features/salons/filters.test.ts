import { activeFilterCount, DEFAULT_FILTERS, dayOptions, nextSlotLabel, searchParams, type SalonFilters } from "./filters";

const HERE = { latitude: 48.86, longitude: 2.34 };
const FIRST_PAGE = { limit: 20, offset: 0 };
// Monday 28 September 2026, 8:00 local time.
const MONDAY = new Date(2026, 8, 28, 8, 0);

describe("searchParams", () => {
  it("sends only where the client is and the page when nothing is filtered", () => {
    expect(searchParams(DEFAULT_FILTERS, HERE, FIRST_PAGE)).toEqual({ lat: 48.86, lng: 2.34, limit: 20, offset: 0 });
  });

  it("turns every filter into the server's parameters", () => {
    const filters: SalonFilters = {
      query: "  balayage paris ",
      specialties: ["afro", "tresses"],
      maxDistanceKm: 5,
      sort: "availability",
      priceMin: 30,
      priceMax: 60,
      openWhen: "2026-10-03",
      openAfter: 18 * 60,
      practiceZone: "domicile",
    };

    expect(searchParams(filters, HERE, { limit: 20, offset: 40 })).toEqual({
      lat: 48.86,
      lng: 2.34,
      radiusKm: 5,
      query: "balayage paris",
      specialties: "afro,tresses",
      sort: "availability",
      priceMin: 30,
      priceMax: 60,
      openOn: "2026-10-03",
      openAfter: "18:00",
      practiceZone: "domicile",
      limit: 20,
      offset: 40,
    });
  });

  it("asks for salons open right now, and inside the map's area", () => {
    expect(
      searchParams({ ...DEFAULT_FILTERS, openWhen: "now" }, null, { limit: 100, offset: 0 }, [48.8, 2.2, 48.9, 2.4]),
    ).toEqual({ openNow: true, bounds: "48.8,2.2,48.9,2.4", limit: 100, offset: 0 });
  });
});

describe("activeFilterCount", () => {
  it("counts each filter that narrows the list, and a sort other than distance", () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(
      activeFilterCount({
        ...DEFAULT_FILTERS,
        specialties: ["coupe", "barbier"],
        priceMax: 30,
        openWhen: "now",
        openAfter: 18 * 60,
        practiceZone: "salon",
        sort: "rating",
      }),
    ).toBe(7);
  });
});

describe("dayOptions", () => {
  it("offers today, tomorrow, then the next days by name", () => {
    expect(dayOptions(4, MONDAY)).toEqual([
      { key: "2026-09-28", label: "Aujourd'hui" },
      { key: "2026-09-29", label: "Demain" },
      { key: "2026-09-30", label: "mer. 30" },
      { key: "2026-10-01", label: "jeu. 1" },
    ]);
  });
});

describe("nextSlotLabel", () => {
  it("says when a salon is next free: today, tomorrow, or which day", () => {
    expect(nextSlotLabel(new Date(2026, 8, 28, 14, 30).toISOString(), MONDAY)).toBe("Dispo aujourd'hui 14:30");
    expect(nextSlotLabel(new Date(2026, 8, 29, 9, 0).toISOString(), MONDAY)).toBe("Dispo demain 09:00");
    expect(nextSlotLabel(new Date(2026, 9, 2, 10, 30).toISOString(), MONDAY)).toBe("Dispo ven. 2 oct. 10:30");
  });
});
