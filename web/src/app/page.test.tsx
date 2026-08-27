import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home", () => {
  it("renders the logo and heading", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "App" })).toBeInTheDocument();
    expect(screen.getByAltText("Logo")).toBeInTheDocument();
  });
});
