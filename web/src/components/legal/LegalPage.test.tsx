import { render, screen } from "@testing-library/react";
import type { LegalDocument } from "@/content/legal/types";
import { LegalPage } from "./LegalPage";

const DOCUMENT: LegalDocument = {
  title: "Conditions générales d'utilisation",
  version: "Version du 29 septembre 2026",
  sections: [
    { title: "1. Éditeur", blocks: ["Le Service est édité par [Dénomination sociale à compléter]."] },
    { title: "2. Données", blocks: [["Voir la [politique de confidentialité](/confidentialite)."]] },
  ],
};

describe("LegalPage", () => {
  it("shows the title, the version, the text, and links to the other legal pages", () => {
    render(<LegalPage document={DOCUMENT} path="/cgu" />);

    expect(screen.getByRole("heading", { level: 1, name: "Conditions générales d'utilisation" })).toBeInTheDocument();
    expect(screen.getByText("Version du 29 septembre 2026")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "2. Données" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "politique de confidentialité" })).toHaveAttribute("href", "/confidentialite");
    const legal = screen.getByRole("navigation", { name: "Informations légales" });
    expect(legal).toHaveTextContent("Politique de confidentialité");
    expect(legal).not.toHaveTextContent("Conditions générales d'utilisation");
  });

  it("marks a field still to fill in, so none is missed before launch", () => {
    const { container } = render(<LegalPage document={DOCUMENT} path="/cgu" />);

    expect([...container.querySelectorAll("mark")].map((mark) => mark.textContent)).toEqual(["[Dénomination sociale à compléter]"]);
  });
});
