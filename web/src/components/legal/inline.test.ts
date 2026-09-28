import { CGU } from "@/content/legal/cgu";
import { PRIVACY_POLICY } from "@/content/legal/confidentialite";
import { LEGAL_NOTICE } from "@/content/legal/mentions-legales";
import { inlineParts, missingFields } from "./inline";

describe("inlineParts", () => {
  it("finds the links and the fields still to fill in, in order", () => {
    expect(inlineParts("Voir la [politique de confidentialité](/confidentialite). Contact : [E-mail de contact à compléter].")).toEqual([
      { kind: "text", text: "Voir la " },
      { kind: "link", text: "politique de confidentialité", href: "/confidentialite" },
      { kind: "text", text: ". Contact : " },
      { kind: "missing", text: "E-mail de contact à compléter" },
      { kind: "text", text: "." },
    ]);
  });

  it("leaves plain text, and brackets that are neither, as they are", () => {
    expect(inlineParts("Prix [TTC] affichés.")).toEqual([{ kind: "text", text: "Prix [TTC] affichés." }]);
  });
});

describe("missingFields", () => {
  it("lists every company field the legal pages still wait for", () => {
    const missing = missingFields([CGU, PRIVACY_POLICY, LEGAL_NOTICE]);

    // Until company.ts is filled in: its name, form, capital, address, registration, VAT, director, e-mail, phone and mediator.
    expect(missing).toEqual(expect.arrayContaining(["Dénomination sociale à compléter", "E-mail de contact à compléter"]));
    expect(new Set(missing).size).toBe(missing.length);
  });
});
