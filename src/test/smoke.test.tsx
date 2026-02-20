import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("Frontend test infrastructure", () => {
  it("renders and queries DOM with jsdom", () => {
    render(<div>hello</div>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});
