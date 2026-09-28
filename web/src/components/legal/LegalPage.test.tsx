import { render, screen } from "@testing-library/react";
import { CGU } from "@/content/legal/cgu";
import { TERMS_DATE } from "@/content/legal/company";
import { LegalPage } from "./LegalPage";

describe("LegalPage", () => {
  it("shows the title, the version, the text, and links to the other legal pages", () => {
    render(<LegalPage document={CGU} path="/cgu" />);

    expect(screen.getByRole("heading", { level: 1, name: "Conditions générales d'utilisation" })).toBeInTheDocument();
    expect(screen.getByText(`Version du ${TERMS_DATE}`)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "9. Annulation, modification et remboursement" })).toBeInTheDocument();
    const legal = screen.getByRole("navigation", { name: "Informations légales" });
    expect(legal).toHaveTextContent("Politique de confidentialité");
    expect(legal).not.toHaveTextContent("Conditions générales d'utilisation");
  });

  it("marks every company field still to fill in, so none is missed before launch", () => {
    const { container } = render(<LegalPage document={CGU} path="/cgu" />);

    const marks = [...container.querySelectorAll("mark")].map((mark) => mark.textContent);
    expect(marks).toContain("[Dénomination sociale à compléter]");
  });
});
