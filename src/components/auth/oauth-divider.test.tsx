import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OAuthDivider } from "./oauth-divider";

describe("OAuthDivider", () => {
  it("renders the OR divider text", () => {
    render(<OAuthDivider />);
    expect(screen.getByText("orContinueWith")).toBeInTheDocument();
  });

  it("renders two horizontal line dividers", () => {
    const { container } = render(<OAuthDivider />);
    const lines = container.querySelectorAll(".h-px");
    expect(lines).toHaveLength(2);
  });
});
