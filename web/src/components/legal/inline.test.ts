import type { LegalDocument } from "@/content/legal/types";
import { inlineParts, missingFields } from "./inline";

const DRAFT: LegalDocument = {
  title: "Mentions légales",
  intro: "Éditée par [Dénomination sociale à compléter].",
  sections: [
    { title: "Contact", blocks: ["Écrire à [E-mail de contact à compléter].", ["Siège : [Adresse à compléter]", "Voir les [CGU](/cgu)."]] },
    { title: "Encore", blocks: ["[E-mail de contact à compléter], une seconde fois."] },
  ],
};

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
  it("lists every field still to fill in, once each, from the intro, paragraphs and lists", () => {
    expect(missingFields([DRAFT])).toEqual([
      "Dénomination sociale à compléter",
      "E-mail de contact à compléter",
      "Adresse à compléter",
    ]);
  });
});
