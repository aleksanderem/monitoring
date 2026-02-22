import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useQuery } from "convex/react";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    health: {
      getPublicHealth: "health:getPublicHealth",
    },
  },
}));

import StatusPage from "@/app/(public)/status/page";

describe("R35 — Health Checks & Status Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Status Page rendering ---

  it("renders the status page title", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    render(<StatusPage />);
    expect(screen.getByText("statusTitle")).toBeInTheDocument();
  });

  it("renders the status page description", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    render(<StatusPage />);
    expect(screen.getByText("statusDescription")).toBeInTheDocument();
  });

  it("shows loading/checking state when query returns undefined", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    render(<StatusPage />);
    expect(screen.getByText("statusChecking")).toBeInTheDocument();
  });

  it("shows 'All Systems Operational' when status is healthy", () => {
    vi.mocked(useQuery).mockReturnValue({
      status: "healthy",
      timestamp: Date.now(),
      services: {
        database: "up",
        email: "up",
        api: "up",
        auth: "up",
      },
    });
    render(<StatusPage />);
    expect(screen.getByText("statusAllOperational")).toBeInTheDocument();
  });

  it("shows 'Degraded Performance' when status is degraded", () => {
    vi.mocked(useQuery).mockReturnValue({
      status: "degraded",
      timestamp: Date.now(),
      services: {
        database: "up",
        email: "down",
        api: "up",
        auth: "up",
      },
    });
    render(<StatusPage />);
    expect(screen.getByText("statusDegraded")).toBeInTheDocument();
  });

  it("shows 'Service Disruption' when status is down", () => {
    vi.mocked(useQuery).mockReturnValue({
      status: "down",
      timestamp: Date.now(),
      services: {
        database: "down",
        email: "down",
        api: "down",
        auth: "down",
      },
    });
    render(<StatusPage />);
    expect(screen.getByText("statusDown")).toBeInTheDocument();
  });

  it("renders all service list items", () => {
    vi.mocked(useQuery).mockReturnValue({
      status: "healthy",
      timestamp: Date.now(),
      services: {
        database: "up",
        email: "up",
        api: "up",
        auth: "up",
      },
    });
    render(<StatusPage />);
    expect(screen.getByText("database")).toBeInTheDocument();
    expect(screen.getByText("email")).toBeInTheDocument();
    expect(screen.getByText("api")).toBeInTheDocument();
    expect(screen.getByText("auth")).toBeInTheDocument();
  });

  it("shows last updated timestamp when health data is available", () => {
    const timestamp = 1700000000000;
    vi.mocked(useQuery).mockReturnValue({
      status: "healthy",
      timestamp,
      services: {
        database: "up",
        email: "up",
        api: "up",
        auth: "up",
      },
    });
    render(<StatusPage />);
    const lastUpdatedEl = screen.getByText(/statusLastUpdated/);
    expect(lastUpdatedEl).toBeInTheDocument();
  });

  it("does not show last updated when health data is undefined", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    render(<StatusPage />);
    expect(screen.queryByText(/statusLastUpdated/)).not.toBeInTheDocument();
  });

  // --- StatusBadge color tests ---

  it("renders green badge for healthy status", () => {
    vi.mocked(useQuery).mockReturnValue({
      status: "healthy",
      timestamp: Date.now(),
      services: { database: "up", email: "up", api: "up", auth: "up" },
    });
    render(<StatusPage />);
    const badges = screen.getAllByLabelText(/Status:/);
    // The overall status badge should be green (healthy)
    const overallBadge = badges[0];
    expect(overallBadge.className).toContain("bg-green-500");
  });

  it("renders yellow badge for degraded status", () => {
    vi.mocked(useQuery).mockReturnValue({
      status: "degraded",
      timestamp: Date.now(),
      services: { database: "up", email: "down", api: "up", auth: "up" },
    });
    render(<StatusPage />);
    const badges = screen.getAllByLabelText("Status: degraded");
    expect(badges[0].className).toContain("bg-yellow-500");
  });

  it("renders red badge for down status", () => {
    vi.mocked(useQuery).mockReturnValue({
      status: "down",
      timestamp: Date.now(),
      services: { database: "down", email: "down", api: "down", auth: "down" },
    });
    render(<StatusPage />);
    const badges = screen.getAllByLabelText("Status: down");
    expect(badges.length).toBeGreaterThan(0);
    expect(badges[0].className).toContain("bg-red-500");
  });

  it("renders gray badge for unknown service status", () => {
    vi.mocked(useQuery).mockReturnValue({
      status: "healthy",
      timestamp: Date.now(),
      services: { database: "up", email: "unknown", api: "up", auth: "up" },
    });
    render(<StatusPage />);
    const badges = screen.getAllByLabelText("Status: unknown");
    expect(badges[0].className).toContain("bg-gray-400");
  });
});
