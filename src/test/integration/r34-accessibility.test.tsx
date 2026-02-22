import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

import AccessibilityPage, {
  metadata,
} from "@/app/(public)/accessibility/page";

describe("R34 — Accessibility Statement Page", () => {
  it("renders the main heading", () => {
    render(<AccessibilityPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /accessibility statement/i })
    ).toBeInTheDocument();
  });

  it("has 'Our Commitment' section", () => {
    render(<AccessibilityPage />);
    expect(
      screen.getByRole("heading", { level: 2, name: /our commitment/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/committed to ensuring digital accessibility/i)
    ).toBeInTheDocument();
  });

  it("has 'Conformance Status' section", () => {
    render(<AccessibilityPage />);
    expect(
      screen.getByRole("heading", { level: 2, name: /conformance status/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/WCAG.*2\.1.*Level AA/i)).toBeInTheDocument();
  });

  it("has 'Technologies Used' section", () => {
    render(<AccessibilityPage />);
    expect(
      screen.getByRole("heading", { level: 2, name: /technologies used/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/HTML5 with semantic markup/i)).toBeInTheDocument();
    expect(screen.getByText(/WAI-ARIA/i)).toBeInTheDocument();
    expect(screen.getByText(/React Aria/i)).toBeInTheDocument();
    expect(screen.getByText(/prefers-reduced-motion/i)).toBeInTheDocument();
  });

  it("has 'Known Limitations' section", () => {
    render(<AccessibilityPage />);
    expect(
      screen.getByRole("heading", { level: 2, name: /known limitations/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/charts and data visualizations/i)
    ).toBeInTheDocument();
  });

  it("has 'Feedback' section with email link", () => {
    render(<AccessibilityPage />);
    expect(
      screen.getByRole("heading", { level: 2, name: /feedback/i })
    ).toBeInTheDocument();
    const emailLink = screen.getByRole("link", {
      name: /accessibility@dseo\.app/i,
    });
    expect(emailLink).toBeInTheDocument();
    expect(emailLink).toHaveAttribute("href", "mailto:accessibility@dseo.app");
  });

  it("has 'Assessment Methods' section", () => {
    render(<AccessibilityPage />);
    expect(
      screen.getByRole("heading", { level: 2, name: /assessment methods/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/axe-core/i)).toBeInTheDocument();
  });

  it("uses semantic HTML with a main element", () => {
    render(<AccessibilityPage />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("has correct heading hierarchy (one h1, multiple h2s)", () => {
    render(<AccessibilityPage />);
    const h1s = screen.getAllByRole("heading", { level: 1 });
    const h2s = screen.getAllByRole("heading", { level: 2 });
    expect(h1s).toHaveLength(1);
    expect(h2s.length).toBeGreaterThanOrEqual(6);
  });

  it("email link uses mailto: protocol", () => {
    render(<AccessibilityPage />);
    const link = screen.getByRole("link", {
      name: /accessibility@dseo\.app/i,
    });
    expect(link.getAttribute("href")).toMatch(/^mailto:/);
  });

  it("renders with dark mode compatible class names", () => {
    const { container } = render(<AccessibilityPage />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("dark:bg-gray-950");

    const paragraphs = container.querySelectorAll("p");
    const hasDarkText = Array.from(paragraphs).some((p) =>
      p.className.includes("dark:text-gray-300")
    );
    expect(hasDarkText).toBe(true);
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Accessibility Statement | DSEO");
    expect(metadata.description).toContain("WCAG 2.1 AA");
  });
});
