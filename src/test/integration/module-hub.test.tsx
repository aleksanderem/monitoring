/**
 * Integration tests for ModuleHubCard.
 *
 * Tests interaction behaviors: locked state, ready/unlocked state,
 * benefit text expansion, and prerequisite badge navigation.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before the component import
// ---------------------------------------------------------------------------

vi.mock("motion/react", () => {
  const Component = React.forwardRef<HTMLDivElement, Record<string, unknown>>(
    ({ children, ...props }, ref) => {
      const domSafe: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(props)) {
        if (
          [
            "className", "style", "id", "role", "onClick",
            "data-testid", "type", "tabIndex", "onKeyDown",
            "aria-label",
          ].includes(k)
        ) {
          domSafe[k] = v;
        }
      }
      return <div ref={ref} {...domSafe}>{children as React.ReactNode}</div>;
    }
  );
  Component.displayName = "MotionComponent";
  return {
    motion: new Proxy({}, { get: () => Component, has: () => true }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useMotionValue: () => ({ get: () => 0, set: vi.fn() }),
    useTransform: () => ({ get: () => 0 }),
    useSpring: () => ({ get: () => 0 }),
    useInView: () => true,
    animate: vi.fn(),
  };
});

vi.mock("@xyflow/react", () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    getNodes: () => [], getEdges: () => [], setNodes: vi.fn(), setEdges: vi.fn(),
    fitView: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(),
  }),
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Handle: () => <div />,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  MarkerType: { Arrow: "arrow", ArrowClosed: "arrowclosed" },
  ReactFlow: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Background: () => <div />,
  Controls: () => <div />,
  MiniMap: () => <div />,
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
}));

vi.mock("@/components/foundations/ez-icon", () => ({
  EzIcon: (props: Record<string, unknown>) => (
    <span data-testid={`ez-icon-${props.name}`} />
  ),
}));

vi.mock("@/components/ui/glowing-effect", () => ({
  GlowingEffect: () => null,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/use-outside-click", () => ({
  useOutsideClick: vi.fn(),
}));

vi.mock("@/hooks/useEscapeClose", () => ({
  useEscapeClose: vi.fn(),
}));

vi.mock("@/components/ai/canvas", () => ({
  Canvas: () => <div data-testid="canvas-mock" />,
}));

// ---------------------------------------------------------------------------
// Import the component under test
// ---------------------------------------------------------------------------

import { ModuleHubCard, type ModuleHubData } from "@/components/domain/cards/ModuleHubCard";
import type { ModuleState } from "@/hooks/useModuleReadiness";

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const baseColors: [number, number, number][] = [[59, 130, 246], [99, 102, 241]];

function makeState(overrides: Partial<ModuleState> = {}): ModuleState {
  return {
    visible: true,
    locked: false,
    lockReason: "",
    status: "ready",
    ...overrides,
  };
}

const defaultProps = {
  tabId: "monitoring",
  title: "Live Positions",
  description: "Track your keyword rankings in real time",
  icon: "activity-04",
  colors: baseColors,
  onClick: vi.fn(),
  onNavigateToTab: vi.fn(),
  data: { domain: "example.com" } as ModuleHubData,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ModuleHubCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Locked state ───────────────────────────────────────────────────

  describe("locked state", () => {
    it("does not fire onClick when the card is locked", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      render(
        <ModuleHubCard
          {...defaultProps}
          onClick={onClick}
          state={makeState({ locked: true, lockReason: "lockReasonAddKeywordsAndCheck" })}
        />
      );

      // The card renders as a <button> but with onClick set to undefined when locked.
      // "Live Positions" appears in both the skeleton header and the card title, so
      // we target the outer <button> element directly.
      const cardButton = screen.getByRole("button", { name: /Live Positions/i });
      await user.click(cardButton);
      expect(onClick).not.toHaveBeenCalled();
    });

    it("shows lock overlay with lock icon and reason text when locked", () => {
      render(
        <ModuleHubCard
          {...defaultProps}
          state={makeState({ locked: true, lockReason: "lockReasonAddKeywordsAndCheck" })}
        />
      );

      // Lock icon should be rendered
      expect(screen.getByTestId("ez-icon-square-lock-01")).toBeInTheDocument();

      // Lock reason text should be visible (the component uses its own I18N, not next-intl)
      expect(screen.getByText("Add keywords and run first position check")).toBeInTheDocument();
    });

    it("shows prerequisite badges for the lock reason", () => {
      render(
        <ModuleHubCard
          {...defaultProps}
          tabId="content-gaps"
          title="Gap Analysis"
          state={makeState({ locked: true, lockReason: "lockReasonRunAnalysis" })}
        />
      );

      // lockReasonRunAnalysis maps to prerequisite ["competitors"]
      // The badge text is loc("shell.competitors") = "Competitor Overview"
      expect(screen.getByText("Competitor Overview")).toBeInTheDocument();
    });
  });

  // ── 2. Ready / unlocked state ─────────────────────────────────────────

  describe("ready (unlocked) state", () => {
    it("fires onClick when the card is clicked", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      render(
        <ModuleHubCard
          {...defaultProps}
          onClick={onClick}
          state={makeState({ locked: false })}
        />
      );

      const cardButton = screen.getByRole("button", { name: /Live Positions/i });
      await user.click(cardButton);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("does not show lock overlay when unlocked", () => {
      render(
        <ModuleHubCard
          {...defaultProps}
          state={makeState({ locked: false })}
        />
      );

      expect(screen.queryByTestId("ez-icon-square-lock-01")).not.toBeInTheDocument();
    });

    it("displays metric text when state has a metric", () => {
      render(
        <ModuleHubCard
          {...defaultProps}
          state={makeState({ locked: false, metric: "42 keywords tracked" })}
        />
      );

      expect(screen.getByText("42 keywords tracked")).toBeInTheDocument();
    });
  });

  // ── 3. Benefit text expansion ─────────────────────────────────────────

  describe("benefit text", () => {
    it("shows benefit overlay when info button is clicked on a locked card", async () => {
      const user = userEvent.setup();

      render(
        <ModuleHubCard
          {...defaultProps}
          state={makeState({ locked: true, lockReason: "lockReasonAddKeywordsAndCheck" })}
          benefitText={"Track your keyword positions daily.\n\nGet alerts when rankings change."}
          benefitLabel="What does this do?"
        />
      );

      // The info button text comes from loc("lockMoreInfo") = "How does it work?"
      const infoButton = screen.getByText("How does it work?");
      await user.click(infoButton);

      // After clicking, the benefit overlay should appear with the paragraphs
      expect(screen.getByText("Track your keyword positions daily.")).toBeInTheDocument();
      expect(screen.getByText("Get alerts when rankings change.")).toBeInTheDocument();
      // benefitLabel should appear in the overlay header
      expect(screen.getByText("What does this do?")).toBeInTheDocument();
    });

    it("shows benefit overlay when info button is clicked and uses default label", async () => {
      const user = userEvent.setup();

      render(
        <ModuleHubCard
          {...defaultProps}
          state={makeState({ locked: true, lockReason: "lockReasonAddKeywordsAndCheck" })}
          benefitText="Some benefit text here."
        />
      );

      const infoButton = screen.getByText("How does it work?");
      await user.click(infoButton);

      expect(screen.getByText("Some benefit text here.")).toBeInTheDocument();
      // Default benefitLabel is "Co mi to daje?"
      expect(screen.getByText("Co mi to daje?")).toBeInTheDocument();
    });
  });

  // ── 4. Navigate to prerequisite tab ───────────────────────────────────

  describe("prerequisite badge navigation", () => {
    it("calls onNavigateToTab when a prerequisite badge is clicked", async () => {
      const user = userEvent.setup();
      const onNavigateToTab = vi.fn();

      render(
        <ModuleHubCard
          {...defaultProps}
          tabId="monitoring"
          onNavigateToTab={onNavigateToTab}
          state={makeState({ locked: true, lockReason: "lockReasonAddKeywordsAndCheck" })}
        />
      );

      // lockReasonAddKeywordsAndCheck prereqs = ["settings"]
      // The badge text is loc("shell.settings") = "Domain Config"
      const badge = screen.getByText("Domain Config");
      await user.click(badge);

      expect(onNavigateToTab).toHaveBeenCalledWith("settings");
    });

    it("calls onNavigateToTab with correct tab for lockReasonRunAnalysis", async () => {
      const user = userEvent.setup();
      const onNavigateToTab = vi.fn();

      render(
        <ModuleHubCard
          {...defaultProps}
          tabId="content-gaps"
          onNavigateToTab={onNavigateToTab}
          state={makeState({ locked: true, lockReason: "lockReasonRunAnalysis" })}
        />
      );

      // lockReasonRunAnalysis prereqs = ["competitors"]
      // The badge text is loc("shell.competitors") = "Competitor Overview"
      const badge = screen.getByText("Competitor Overview");
      await user.click(badge);

      expect(onNavigateToTab).toHaveBeenCalledWith("competitors");
    });
  });
});
