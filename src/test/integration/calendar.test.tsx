/**
 * Integration tests for the Calendar (AI SEO Strategist) page.
 * Tests loading, empty state, domain selection, category tabs, events, and AI plan generation.
 *
 * useTranslations is globally mocked as a key passthrough (from setup.ts),
 * so t("nav.someKey") returns "someKey".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery, useAction } from "convex/react";
import { getFunctionName } from "convex/server";

// ---------------------------------------------------------------------------
// Mocks (hoisted)
// ---------------------------------------------------------------------------

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  usePaginatedQuery: vi.fn(() => ({
    results: [],
    status: "Exhausted",
    loadMore: vi.fn(),
    isLoading: false,
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/calendar",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    permissions: [],
    modules: [],
    role: "admin",
    plan: { name: "Pro", key: "pro" },
    isLoading: false,
    can: () => true,
    hasModule: () => true,
  }),
}));

vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissions: () => ({
    permissions: [],
    modules: [],
    role: "admin",
    plan: { name: "Pro", key: "pro" },
    isLoading: false,
    can: () => true,
    hasModule: () => true,
  }),
}));

vi.mock("@/components/shared/LoadingState", () => ({
  LoadingState: (props: Record<string, unknown>) => (
    <div data-testid="loading-state" data-type={props.type}>Loading...</div>
  ),
}));

vi.mock("@/components/ui/glowing-effect", () => ({
  GlowingEffect: () => null,
}));

vi.mock("motion/react", () => ({
  motion: new Proxy({}, { get: () => (props: Record<string, unknown>) => <div {...props} /> }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock the Calendar component — the real one depends on @internationalized/date
// and complex react-aria internals that don't work in jsdom
vi.mock("@/components/application/calendar/calendar", () => ({
  Calendar: ({ events, view }: { events: Array<{ id: string; title: string }>; view: string }) => (
    <div data-testid="calendar-component" data-view={view}>
      {events.map((e: { id: string; title: string }) => (
        <div key={e.id} data-testid="calendar-event">
          {e.title}
        </div>
      ))}
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupQueries(responses: Record<string, unknown>) {
  vi.mocked(useQuery).mockImplementation(((ref: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    try {
      const name = getFunctionName(ref as any);
      if (name in responses) return responses[name];
    } catch {
      // ignore
    }
    return undefined;
  }) as any);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DOMAIN_1 = {
  _id: "domain_1",
  _creationTime: Date.now(),
  domain: "example.com",
  projectId: "proj_1",
};

const DOMAIN_2 = {
  _id: "domain_2",
  _creationTime: Date.now(),
  domain: "blog.example.com",
  projectId: "proj_1",
};

const CALENDAR_EVENTS = [
  {
    _id: "evt_1",
    _creationTime: Date.now(),
    domainId: "domain_1",
    title: "Position drop: keyword research",
    category: "ranking_drop",
    scheduledAt: Date.now(),
    scheduledEndAt: Date.now() + 60 * 60 * 1000,
    priority: "high",
    color: "pink",
  },
  {
    _id: "evt_2",
    _creationTime: Date.now(),
    domainId: "domain_1",
    title: "Content opportunity: SEO guide",
    category: "content_plan",
    scheduledAt: Date.now() + 86400000,
    scheduledEndAt: Date.now() + 86400000 + 60 * 60 * 1000,
    priority: "medium",
    color: "green",
  },
];

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

let CalendarPage: React.ComponentType;

beforeEach(async () => {
  vi.mocked(useQuery).mockImplementation((() => undefined) as any);
  vi.mocked(useAction).mockReturnValue(vi.fn() as any);
  const mod = await import("@/app/(dashboard)/calendar/page");
  CalendarPage = mod.default;
});

describe("Calendar Page", () => {
  describe("Loading state", () => {
    it("shows empty state placeholder when domains query returns undefined", () => {
      // domains = undefined (loading), so activeDomainId is undefined
      render(<CalendarPage />);

      // When domains is still loading (undefined), activeDomainId is undefined,
      // so the "Brak domen" empty state should be shown
      expect(screen.getByText("Brak domen")).toBeInTheDocument();
    });
  });

  describe("Empty state", () => {
    it("shows no-domains empty state when domains returns empty array", () => {
      setupQueries({
        "domains:list": [],
      });

      render(<CalendarPage />);

      expect(screen.getByText("Brak domen")).toBeInTheDocument();
      expect(
        screen.getByText(/Dodaj domenę, aby AI SEO Strategist/)
      ).toBeInTheDocument();
    });
  });

  describe("Domain selection", () => {
    it("auto-selects single domain without showing dropdown", () => {
      setupQueries({
        "domains:list": [DOMAIN_1],
        "calendarEvents:getEvents": [],
      });

      render(<CalendarPage />);

      // With a single domain, the <select> should NOT render
      const selectEl = screen.queryByRole("combobox");
      expect(selectEl).not.toBeInTheDocument();

      // Calendar should render (domain is auto-selected)
      expect(screen.getByTestId("calendar-component")).toBeInTheDocument();
    });

    it("shows domain selector when multiple domains exist", () => {
      setupQueries({
        "domains:list": [DOMAIN_1, DOMAIN_2],
        "calendarEvents:getEvents": [],
      });

      render(<CalendarPage />);

      // The native <select> should be present
      const selectEl = screen.getByRole("combobox");
      expect(selectEl).toBeInTheDocument();

      // Both domain names should appear as options
      expect(screen.getByText("example.com")).toBeInTheDocument();
      expect(screen.getByText("blog.example.com")).toBeInTheDocument();
    });
  });

  describe("Category filter tabs", () => {
    it("renders all 6 category tabs", () => {
      setupQueries({
        "domains:list": [DOMAIN_1],
        "calendarEvents:getEvents": [],
      });

      render(<CalendarPage />);

      expect(screen.getByText("Wszystkie")).toBeInTheDocument();
      expect(screen.getByText("Spadki pozycji")).toBeInTheDocument();
      expect(screen.getByText("Szanse")).toBeInTheDocument();
      expect(screen.getByText("Treści")).toBeInTheDocument();
      expect(screen.getByText("Link building")).toBeInTheDocument();
      expect(screen.getByText("Audyty")).toBeInTheDocument();
    });

    it("switches active tab when clicking a category", async () => {
      setupQueries({
        "domains:list": [DOMAIN_1],
        "calendarEvents:getEvents": [],
      });

      render(<CalendarPage />);
      const user = userEvent.setup();

      // Click the "Spadki pozycji" tab
      const rankingTab = screen.getByText("Spadki pozycji");
      await user.click(rankingTab);

      // The tab should now be selected (react-aria sets aria-selected)
      expect(rankingTab.closest("[role='tab']")).toHaveAttribute(
        "aria-selected",
        "true"
      );
    });
  });

  describe("Events rendering", () => {
    it("displays calendar events when data is loaded", () => {
      setupQueries({
        "domains:list": [DOMAIN_1],
        "calendarEvents:getEvents": CALENDAR_EVENTS,
      });

      render(<CalendarPage />);

      expect(screen.getByTestId("calendar-component")).toBeInTheDocument();
      const eventEls = screen.getAllByTestId("calendar-event");
      expect(eventEls).toHaveLength(2);
      expect(screen.getByText("Position drop: keyword research")).toBeInTheDocument();
      expect(screen.getByText("Content opportunity: SEO guide")).toBeInTheDocument();
    });

    it("passes month view to the calendar component", () => {
      setupQueries({
        "domains:list": [DOMAIN_1],
        "calendarEvents:getEvents": [],
      });

      render(<CalendarPage />);

      expect(screen.getByTestId("calendar-component")).toHaveAttribute(
        "data-view",
        "month"
      );
    });
  });

  describe("Generate plan button", () => {
    it("renders generate plan button with correct label", () => {
      setupQueries({
        "domains:list": [DOMAIN_1],
        "calendarEvents:getEvents": [],
      });

      render(<CalendarPage />);

      expect(screen.getByText("Generuj plan")).toBeInTheDocument();
    });

    it("calls runStrategist action when generate button is clicked", async () => {
      const mockRunStrategist = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAction).mockReturnValue(mockRunStrategist as any);

      setupQueries({
        "domains:list": [DOMAIN_1],
        "calendarEvents:getEvents": [],
      });

      render(<CalendarPage />);
      const user = userEvent.setup();

      await user.click(screen.getByText("Generuj plan"));

      expect(mockRunStrategist).toHaveBeenCalledWith({ domainId: "domain_1" });
    });

    it("shows loading state while generating plan", async () => {
      // Create a promise that we can control resolution of
      let resolveAction!: () => void;
      const actionPromise = new Promise<void>((resolve) => {
        resolveAction = resolve;
      });
      const mockRunStrategist = vi.fn().mockReturnValue(actionPromise);
      vi.mocked(useAction).mockReturnValue(mockRunStrategist as any);

      setupQueries({
        "domains:list": [DOMAIN_1],
        "calendarEvents:getEvents": [],
      });

      render(<CalendarPage />);
      const user = userEvent.setup();

      // Click generate
      await user.click(screen.getByText("Generuj plan"));

      // While running, button text should change
      expect(screen.getByText("Generowanie...")).toBeInTheDocument();

      // Resolve the action
      resolveAction();
    });

    it("disables generate button when no domain is selected", () => {
      setupQueries({
        "domains:list": [],
      });

      render(<CalendarPage />);

      const button = screen.getByText("Generuj plan").closest("button");
      expect(button).toBeDisabled();
    });
  });

  describe("Page header", () => {
    it("renders page title and description", () => {
      setupQueries({
        "domains:list": [DOMAIN_1],
        "calendarEvents:getEvents": [],
      });

      render(<CalendarPage />);

      expect(screen.getByText("AI SEO Strategist")).toBeInTheDocument();
      expect(
        screen.getByText(/Inteligentny kalendarz SEO/)
      ).toBeInTheDocument();
    });
  });
});
