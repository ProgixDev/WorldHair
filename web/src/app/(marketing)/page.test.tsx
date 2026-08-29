import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home", () => {
  it("renders the WorldHair campaign hero", () => {
    render(<Home />);

    const hero = screen.getByRole("region", { name: "WorldHair" });

    expect(hero).toHaveClass("min-h-screen");
    expect(screen.getByRole("heading", { name: "WorldHair" })).toHaveClass(
      "top-28",
    );
    expect(screen.getByText("Votre style, à votre rythme")).toBeInTheDocument();
  });
});
