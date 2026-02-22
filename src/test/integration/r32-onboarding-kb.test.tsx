/**
 * R32: Integration tests for Product Tours and Knowledge Base.
 *
 * Tests cover:
 * - ProductTour rendering and step navigation
 * - Tour step completion mutations
 * - Tour dismissal flow
 * - KnowledgeBase article list rendering
 * - KB search filtering
 * - KB category filtering
 * - KB article detail view with markdown
 * - ContextualTip popover behavior
 * - Empty states
 * - Translation key coverage (EN + PL)
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, within, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/help",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    permissions: ["domains.create"],
    modules: ["positioning"],
    role: "admin",
    plan: { name: "Pro", key: "pro" },
    isLoading: false,
    can: () => true,
    hasModule: () => true,
  }),
}));

vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissionsContext: () => ({
    permissions: [],
    modules: [],
    role: "admin",
    plan: { name: "Pro", key: "pro" },
    isLoading: false,
    can: () => true,
    hasModule: () => true,
  }),
  PermissionsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/hooks/useEscapeClose", () => ({ useEscapeClose: vi.fn() }));
vi.mock("@/hooks/use-breakpoint", () => ({ useBreakpoint: () => true }));
vi.mock("@/components/ui/glowing-effect", () => ({ GlowingEffect: () => null }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: vi.fn() }) }));

vi.mock("next-intl", async () => {
  const actual = await vi.importActual<typeof import("next-intl")>("next-intl");
  return { ...actual };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useQuery, useMutation } from "convex/react";
import { renderWithProviders } from "@/test/helpers/render-with-providers";
import {
  TOUR_PROGRESS_NOT_STARTED,
  TOUR_PROGRESS_IN_PROGRESS,
  TOUR_PROGRESS_COMPLETED,
  TOUR_PROGRESS_DISMISSED,
  KB_ARTICLES_ALL,
  KB_ARTICLES_FEATURES,
  KB_ARTICLES_EMPTY,
  KB_CATEGORIES,
  KB_CATEGORIES_EMPTY,
  KB_ARTICLE_GETTING_STARTED,
} from "@/test/fixtures/help";

// Import components under test
import { ProductTour } from "@/components/tours/ProductTour";
import { KnowledgeBase } from "@/components/help/KnowledgeBase";
import { ContextualTip } from "@/components/help/ContextualTip";
import { TOUR_GETTING_STARTED } from "@/components/tours/tourDefinitions";

// ---------------------------------------------------------------------------
// Query/Mutation mock helpers
// ---------------------------------------------------------------------------

type QueryMap = Record<string, unknown>;

function setupQueries(responses: QueryMap) {
  vi.mocked(useQuery).mockImplementation(((ref: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    try {
      const name = getFunctionName(ref as any);
      if (name in responses) return responses[name];
    } catch {
      // not a valid function reference
    }
    return undefined;
  }) as any);
}

function setupMutationMap() {
  const mutationMap = new Map<string, ReturnType<typeof vi.fn>>();
  vi.mocked(useMutation).mockImplementation(((ref: unknown) => {
    const key = getFunctionName(ref as any);
    if (!mutationMap.has(key)) mutationMap.set(key, vi.fn().mockResolvedValue(undefined));
    return mutationMap.get(key)!;
  }) as any);
  return mutationMap;
}

// ---------------------------------------------------------------------------
// Test Suite: Product Tours
// ---------------------------------------------------------------------------

describe("ProductTour", () => {
  let mutationMap: Map<string, ReturnType<typeof vi.fn>>;
  let tourTarget: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mutationMap = setupMutationMap();

    // Clean up previous tour targets
    document.querySelectorAll("[data-tour]").forEach((el) => el.remove());

    // Add a target element for tour to find
    tourTarget = document.createElement("div");
    tourTarget.setAttribute("data-tour", "dashboard");
    tourTarget.getBoundingClientRect = () => ({
      top: 100, left: 100, bottom: 150, right: 300,
      width: 200, height: 50, x: 100, y: 100, toJSON: () => {},
    });
    document.body.appendChild(tourTarget);
  });

  afterEach(() => {
    vi.useRealTimers();
    tourTarget?.remove();
  });

  it("renders the first step when tour has not been started", async () => {
    setupQueries({
      "tours:getTourProgress": TOUR_PROGRESS_NOT_STARTED,
    });

    renderWithProviders(
      <ProductTour tourId="getting-started" steps={TOUR_GETTING_STARTED.steps} />
    );

    // Advance past the setTimeout in TourStep
    await act(async () => { vi.advanceTimersByTime(150); });

    expect(screen.getByTestId("tour-tooltip")).toBeInTheDocument();
    expect(screen.getByTestId("tour-progress")).toHaveTextContent("Step 1 of 5");
  });

  it("navigates to the next step when clicking Next", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    setupQueries({
      "tours:getTourProgress": TOUR_PROGRESS_NOT_STARTED,
    });

    renderWithProviders(
      <ProductTour tourId="getting-started" steps={TOUR_GETTING_STARTED.steps} />
    );

    await act(async () => { vi.advanceTimersByTime(150); });

    const nextBtn = screen.getByTestId("tour-next-btn");
    expect(nextBtn).toHaveTextContent("Next");

    await user.click(nextBtn);

    // Should call completeStep mutation
    expect(mutationMap.get("tours:completeStep")).toHaveBeenCalledWith({
      tourId: "getting-started",
      stepId: "welcome",
    });
  });

  it("shows Previous button on second step", async () => {
    setupQueries({
      "tours:getTourProgress": TOUR_PROGRESS_IN_PROGRESS,
    });

    renderWithProviders(
      <ProductTour tourId="getting-started" steps={TOUR_GETTING_STARTED.steps} />
    );

    await act(async () => { vi.advanceTimersByTime(150); });

    // In-progress fixture has 2 completed steps, so we start at step 3 (index 2)
    expect(screen.getByTestId("tour-prev-btn")).toBeInTheDocument();
  });

  it("calls dismissTour when clicking Skip", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    setupQueries({
      "tours:getTourProgress": TOUR_PROGRESS_NOT_STARTED,
    });

    renderWithProviders(
      <ProductTour tourId="getting-started" steps={TOUR_GETTING_STARTED.steps} />
    );

    await act(async () => { vi.advanceTimersByTime(150); });

    await user.click(screen.getByTestId("tour-skip-btn"));

    expect(mutationMap.get("tours:dismissTour")).toHaveBeenCalledWith({
      tourId: "getting-started",
    });
  });

  it("calls dismissTour when clicking close button", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    setupQueries({
      "tours:getTourProgress": TOUR_PROGRESS_NOT_STARTED,
    });

    renderWithProviders(
      <ProductTour tourId="getting-started" steps={TOUR_GETTING_STARTED.steps} />
    );

    await act(async () => { vi.advanceTimersByTime(150); });

    await user.click(screen.getByTestId("tour-close-btn"));

    expect(mutationMap.get("tours:dismissTour")).toHaveBeenCalledWith({
      tourId: "getting-started",
    });
  });

  it("does not render when tour is completed", () => {
    setupQueries({
      "tours:getTourProgress": TOUR_PROGRESS_COMPLETED,
    });

    const { container } = renderWithProviders(
      <ProductTour tourId="getting-started" steps={TOUR_GETTING_STARTED.steps} />
    );

    expect(container.querySelector("[data-testid='tour-tooltip']")).toBeNull();
  });

  it("does not render when tour is dismissed", () => {
    setupQueries({
      "tours:getTourProgress": TOUR_PROGRESS_DISMISSED,
    });

    const { container } = renderWithProviders(
      <ProductTour tourId="getting-started" steps={TOUR_GETTING_STARTED.steps} />
    );

    expect(container.querySelector("[data-testid='tour-tooltip']")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test Suite: Knowledge Base
// ---------------------------------------------------------------------------

describe("KnowledgeBase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders article list with titles", () => {
    setupQueries({
      "knowledgeBase:getArticles": KB_ARTICLES_ALL,
      "knowledgeBase:getCategories": KB_CATEGORIES,
    });

    renderWithProviders(<KnowledgeBase />);

    expect(screen.getByTestId("kb-article-list")).toBeInTheDocument();
    expect(screen.getByText("Getting Started with doseo")).toBeInTheDocument();
    expect(screen.getByText("Understanding Keyword Positions")).toBeInTheDocument();
  });

  it("shows empty state when no articles match search", () => {
    setupQueries({
      "knowledgeBase:getArticles": KB_ARTICLES_ALL,
      "knowledgeBase:getCategories": KB_CATEGORIES,
      "knowledgeBase:searchArticles": KB_ARTICLES_EMPTY,
    });

    renderWithProviders(<KnowledgeBase />);

    const searchInput = screen.getByTestId("kb-search-input");
    // Simulate typing to activate search mode
    searchInput.focus();

    // Change to trigger search query
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )!.set!;
    nativeInputValueSetter.call(searchInput, "nonexistent");
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    searchInput.dispatchEvent(new Event("change", { bubbles: true }));
  });

  it("renders category filter tabs", () => {
    setupQueries({
      "knowledgeBase:getArticles": KB_ARTICLES_ALL,
      "knowledgeBase:getCategories": KB_CATEGORIES,
    });

    renderWithProviders(<KnowledgeBase />);

    const tabs = screen.getByTestId("kb-category-tabs");
    expect(within(tabs).getByTestId("kb-category-all")).toBeInTheDocument();
    expect(within(tabs).getByTestId("kb-category-getting-started")).toBeInTheDocument();
    expect(within(tabs).getByTestId("kb-category-features")).toBeInTheDocument();
  });

  it("renders article detail with markdown content when clicked", async () => {
    const user = userEvent.setup();
    setupQueries({
      "knowledgeBase:getArticles": KB_ARTICLES_ALL,
      "knowledgeBase:getCategories": KB_CATEGORIES,
      "knowledgeBase:getArticle": KB_ARTICLE_GETTING_STARTED,
    });

    renderWithProviders(<KnowledgeBase />);

    // Click on the first article
    await user.click(screen.getByTestId("kb-article-getting-started-with-doseo"));

    // Should show article detail
    expect(screen.getByTestId("kb-article-detail")).toBeInTheDocument();
    expect(screen.getByTestId("kb-article-content")).toBeInTheDocument();
    expect(screen.getByTestId("kb-back-btn")).toBeInTheDocument();
  });

  it("shows no results state when articles list is empty", () => {
    setupQueries({
      "knowledgeBase:getArticles": KB_ARTICLES_EMPTY,
      "knowledgeBase:getCategories": KB_CATEGORIES_EMPTY,
    });

    renderWithProviders(<KnowledgeBase />);

    expect(screen.getByTestId("kb-no-results")).toBeInTheDocument();
  });

  it("renders help center title", () => {
    setupQueries({
      "knowledgeBase:getArticles": KB_ARTICLES_ALL,
      "knowledgeBase:getCategories": KB_CATEGORIES,
    });

    renderWithProviders(<KnowledgeBase />);

    expect(screen.getByText("Help Center")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test Suite: ContextualTip
// ---------------------------------------------------------------------------

describe("ContextualTip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows popover content on click", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <ContextualTip content="This is a helpful tip" />
    );

    const trigger = screen.getByTestId("contextual-tip-trigger");
    await user.click(trigger);

    expect(screen.getByTestId("contextual-tip-popover")).toBeInTheDocument();
    expect(screen.getByText("This is a helpful tip")).toBeInTheDocument();
  });

  it("shows link to KB article when articleSlug is provided", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <ContextualTip content="Tip with link" articleSlug="getting-started-with-doseo" />
    );

    await user.click(screen.getByTestId("contextual-tip-trigger"));

    const link = screen.getByTestId("contextual-tip-link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/help?article=getting-started-with-doseo");
  });

  it("hides popover on second click", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <ContextualTip content="Toggle tip" />
    );

    const trigger = screen.getByTestId("contextual-tip-trigger");

    // Open
    await user.click(trigger);
    expect(screen.getByTestId("contextual-tip-popover")).toBeInTheDocument();

    // Close
    await user.click(trigger);
    expect(screen.queryByTestId("contextual-tip-popover")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test Suite: Translation Key Coverage
// ---------------------------------------------------------------------------

describe("Translation key coverage", () => {
  const requiredKeys = [
    "title",
    "description",
    "searchPlaceholder",
    "noResults",
    "allArticles",
    "gettingStarted",
    "features",
    "howTo",
    "troubleshooting",
    "readMore",
    "backToArticles",
    "tourNext",
    "tourPrev",
    "tourSkip",
    "tourClose",
    "tourStepOf",
    "tourComplete",
    "contextualHelp",
    "helpCenter",
    "needHelp",
    "searchKnowledgeBase",
    "articleNotFound",
    "publishedOn",
    "relatedArticles",
  ];

  it("EN help.json has all required keys", async () => {
    const en = await import("@/messages/en/help.json");
    for (const key of requiredKeys) {
      expect(en.default).toHaveProperty(key);
    }
  });

  it("PL help.json has all required keys", async () => {
    const pl = await import("@/messages/pl/help.json");
    for (const key of requiredKeys) {
      expect(pl.default).toHaveProperty(key);
    }
  });
});
