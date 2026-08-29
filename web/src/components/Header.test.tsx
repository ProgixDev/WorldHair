import { render, screen } from "@testing-library/react";
import { Header } from "./Header";

describe("Header", () => {
  it("overlays the campaign hero at the top of the page", () => {
    render(<Header />);

    expect(screen.getByRole("banner")).toHaveClass("fixed", "top-0");
  });
});
