import { cancellationNote, cancelledLabel } from "./cancellation";

describe("cancelledLabel", () => {
  it("says who cancelled, as the client reads it", () => {
    expect(cancelledLabel("client", "client")).toBe("Annulé par vous");
    expect(cancelledLabel("salon", "client")).toBe("Annulé par le salon");
    expect(cancelledLabel("admin", "client")).toBe("Annulé par WorldHair");
    expect(cancelledLabel("system", "client")).toBe("Sans réponse du salon");
    expect(cancelledLabel(null, "client")).toBe("Annulé");
  });

  it("says who cancelled, as the salon reads it", () => {
    expect(cancelledLabel("client", "salon")).toBe("Annulé par le client");
    expect(cancelledLabel("salon", "salon")).toBe("Annulé par vous");
    expect(cancelledLabel("admin", "salon")).toBe("Annulé par WorldHair");
    expect(cancelledLabel("system", "salon")).toBe("Expiré sans réponse");
    expect(cancelledLabel(undefined, "salon")).toBe("Annulé");
  });
});

describe("cancellationNote", () => {
  it("gives WorldHair's reason — no one else's cancellation has one", () => {
    expect(cancellationNote({ cancelledBy: "admin", cancellationReason: "  Salon fermé ce jour-là.  " })).toBe(
      "Motif : Salon fermé ce jour-là.",
    );
    expect(cancellationNote({ cancelledBy: "admin", cancellationReason: null })).toBeNull();
    expect(cancellationNote({ cancelledBy: "salon", cancellationReason: "x" })).toBeNull();
    expect(cancellationNote({})).toBeNull();
  });
});
