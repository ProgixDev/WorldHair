import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home", () => {
  it("renders the WorldHair campaign hero", () => {
    render(<Home />);

    const hero = screen.getByRole("region", { name: "WorldHair" });

    expect(hero).toHaveClass("min-h-screen");
    // The wordmark sits in normal flow on phones and only takes up the
    // design's absolute placement from `sm` up — those offsets are desktop
    // geometry and overlap the other hero blocks at phone widths.
    const wordmark = screen.getByRole("heading", { name: "WorldHair" });
    expect(wordmark).toHaveClass("static");
    expect(wordmark).toHaveClass("sm:absolute");
    expect(screen.getByText("Votre style, à votre rythme")).toBeInTheDocument();
  });
});
