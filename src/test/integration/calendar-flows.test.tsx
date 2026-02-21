/**
 * Integration tests for Calendar page data flow paths.
 * Tests domain selection logic, event data flow, category filtering,
 * and the runStrategist action trigger.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery, useAction } from "convex/react";
import { getFunctionName } from "convex/server";
import {
  CALENDAR_EVENTS_ALL,
  CALENDAR_EVENT_RANKING_DROP,
  CALENDAR_EVENT_CONTENT_PLAN,
} from "@/test/fixtures/calendar";
import { DOMAIN_ACTIVE, DOMAIN_SECOND } from "@/test/fixtures/domain";

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

// Mock the Calendar component to capture its props
let capturedCalendarProps: { events: any[]; view: string } | null = null;

vi.mock("@/components/application/calendar/calendar", () => ({
  Calendar: ({ events, view }: { events: Array<{ id: string; title: string }>; view: string }) => {
    capturedCalendarProps = { events, view };
    return (
      <div data-testid="calendar-component" data-view={view} data-event-count={events.length}>
        {events.map((e: { id: string; title: string }) => (
          <div key={e.id} data-testid="calendar-event">
            {e.title}
          </div>
        ))}
      </div>
    );
  },
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
// Test suite
// ---------------------------------------------------------------------------

let CalendarPage: React.ComponentType;

beforeEach(async () => {
  vi.mocked(useQuery).mockImplementation((() => undefined) as any);
  vi.mocked(useAction).mockReturnValue(vi.fn() as any);
  capturedCalendarProps = null;
  const mod = await import("@/app/(dashboard)/calendar/page");
  CalendarPage = mod.default;
});

describe("Calendar Flows", () => {
  it("shows empty state when domains list is empty", () => {
    setupQueries({ "domains:list": [] });
    render(<CalendarPage />);

    expect(screen.getByText("Brak domen")).toBeInTheDocument();
    expect(screen.getByText(/Dodaj domenę/)).toBeInTheDocument();
    expect(screen.queryByTestId("calendar-component")).not.toBeInTheDocument();
  });

  it("auto-selects single domain without showing dropdown selector", () => {
    setupQueries({
      "domains:list": [DOMAIN_ACTIVE],
      "calendarEvents:getEvents": [],
    });

    render(<CalendarPage />);

    // No domain selector dropdown for single domain
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    // Calendar renders because domain is auto-selected
    expect(screen.getByTestId("calendar-component")).toBeInTheDocument();
  });

  it("shows domain selector and allows switching when multiple domains exist", async () => {
    setupQueries({
      "domains:list": [DOMAIN_ACTIVE, DOMAIN_SECOND],
      "calendarEvents:getEvents": [],
    });

    render(<CalendarPage />);
    const user = userEvent.setup();

    // Selector should be visible
    const selectEl = screen.getByRole("combobox");
    expect(selectEl).toBeInTheDocument();

    // Both domains should appear as options
    expect(screen.getByText("example.com")).toBeInTheDocument();
    expect(screen.getByText("blog.example.com")).toBeInTheDocument();

    // Switch domain
    await user.selectOptions(selectEl, DOMAIN_SECOND._id);
    expect(selectEl).toHaveValue(DOMAIN_SECOND._id);
  });

  it("passes transformed events to Calendar component", () => {
    setupQueries({
      "domains:list": [DOMAIN_ACTIVE],
      "calendarEvents:getEvents": CALENDAR_EVENTS_ALL,
    });

    render(<CalendarPage />);

    expect(screen.getByTestId("calendar-component")).toBeInTheDocument();

    // All 6 events should appear
    const eventEls = screen.getAllByTestId("calendar-event");
    expect(eventEls).toHaveLength(CALENDAR_EVENTS_ALL.length);

    // Verify specific event titles rendered
    expect(screen.getByText(CALENDAR_EVENT_RANKING_DROP.title)).toBeInTheDocument();
    expect(screen.getByText(CALENDAR_EVENT_CONTENT_PLAN.title)).toBeInTheDocument();

    // Verify Calendar received events with correct structure
    expect(capturedCalendarProps).not.toBeNull();
    expect(capturedCalendarProps!.view).toBe("month");
    expect(capturedCalendarProps!.events).toHaveLength(CALENDAR_EVENTS_ALL.length);

    // Each event should have id, title, start (Date), end (Date), color
    const firstEvent = capturedCalendarProps!.events[0];
    expect(firstEvent.id).toBe(CALENDAR_EVENT_RANKING_DROP._id);
    expect(firstEvent.title).toBe(CALENDAR_EVENT_RANKING_DROP.title);
    expect(firstEvent.start).toBeInstanceOf(Date);
    expect(firstEvent.end).toBeInstanceOf(Date);
    expect(firstEvent.color).toBe("pink");
    // Critical/high priority should have dot=true
    expect(firstEvent.dot).toBe(true);
  });

  it("switches active category tab on click", async () => {
    setupQueries({
      "domains:list": [DOMAIN_ACTIVE],
      "calendarEvents:getEvents": [],
    });

    render(<CalendarPage />);
    const user = userEvent.setup();

    // Click the "Treści" (content_plan) tab
    const contentTab = screen.getByText("Treści");
    await user.click(contentTab);

    // Tab should become selected
    expect(contentTab.closest("[role='tab']")).toHaveAttribute("aria-selected", "true");

    // The "Wszystkie" tab should no longer be selected
    const allTab = screen.getByText("Wszystkie");
    expect(allTab.closest("[role='tab']")).toHaveAttribute("aria-selected", "false");
  });

  it("calls runStrategist action and shows loading state when generate button clicked", async () => {
    let resolveAction!: () => void;
    const actionPromise = new Promise<void>((resolve) => {
      resolveAction = resolve;
    });
    const mockRunStrategist = vi.fn().mockReturnValue(actionPromise);
    vi.mocked(useAction).mockReturnValue(mockRunStrategist as any);

    setupQueries({
      "domains:list": [DOMAIN_ACTIVE],
      "calendarEvents:getEvents": [],
    });

    render(<CalendarPage />);
    const user = userEvent.setup();

    // Click generate plan button
    await user.click(screen.getByText("Generuj plan"));

    // Action should have been called with the domain ID
    expect(mockRunStrategist).toHaveBeenCalledWith({ domainId: DOMAIN_ACTIVE._id });

    // Button should show loading text
    expect(screen.getByText("Generowanie...")).toBeInTheDocument();
    expect(screen.queryByText("Generuj plan")).not.toBeInTheDocument();

    // Resolve to clean up
    resolveAction();
  });
});
