import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ErrorBoundary } from "./ErrorBoundary";

// Helper component that conditionally throws during render
function ThrowingComponent({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) throw new Error("Test render error");
  return <div>Normal content</div>;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("ErrorBoundary", () => {
  it("renders children normally when no error occurs", () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("shows fallback UI with error message when a child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test render error")).toBeInTheDocument();
  });

  it('shows the label in the error message when label prop is provided', () => {
    render(
      <ErrorBoundary label="Page">
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(
      screen.getByText('Something went wrong in "Page"')
    ).toBeInTheDocument();
  });

  it("shows generic message when no label is provided", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("displays the error.message in the fallback", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText("Test render error")).toBeInTheDocument();
  });

  it('"Retry now" button resets the error state and re-renders children', async () => {
    let shouldThrow = true;

    function Toggler() {
      if (shouldThrow) throw new Error("Test render error");
      return <div>Recovered content</div>;
    }

    render(
      <ErrorBoundary>
        <Toggler />
      </ErrorBoundary>
    );

    // Fallback is shown
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Stop throwing before clicking retry
    shouldThrow = false;

    const user = userEvent.setup();
    await user.click(screen.getByText("Retry now"));

    // Children re-render successfully
    expect(screen.getByText("Recovered content")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("calls console.error with the label when an error is caught", () => {
    render(
      <ErrorBoundary label="Dashboard">
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(console.error).toHaveBeenCalledWith(
      "[ErrorBoundary]",
      "Dashboard",
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it('calls console.error with "unknown" when no label is provided', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(console.error).toHaveBeenCalledWith(
      "[ErrorBoundary]",
      "unknown",
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });
});
