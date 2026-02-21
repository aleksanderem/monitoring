/**
 * Integration tests for the Domain Detail page.
 *
 * Tests page-level behavior: header rendering, tab switching, onboarding
 * overlay, permissions gating, module-gated tabs, superadmin diagnostics,
 * and strategy badge. All tab content components are mocked to isolate
 * page structure.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";

// ---------------------------------------------------------------------------
// Hoisted mocks (must be declared before imports that use them)
// ---------------------------------------------------------------------------

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/domains/domain_1",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ domainId: "domain_1" }),
}));

// Default: all modules enabled, all permissions granted
const mockHasModule = vi.fn(() => true);
const mockCan = vi.fn(() => true);

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    permissions: [
      "domains.create", "domains.edit", "domains.delete",
      "keywords.add", "keywords.refresh",
      "reports.create", "reports.share",
    ],
    modules: ["positioning", "backlinks", "seo_audit", "competitors", "ai_strategy", "link_building"],
    role: "admin",
    plan: { name: "Pro", key: "pro" },
    isLoading: false,
    can: mockCan,
    hasModule: mockHasModule,
  }),
}));

vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissionsContext: () => ({
    permissions: [
      "domains.create", "domains.edit", "domains.delete",
      "keywords.add", "keywords.refresh",
      "reports.create", "reports.share",
    ],
    modules: ["positioning", "backlinks", "seo_audit", "competitors", "ai_strategy", "link_building"],
    role: "admin",
    plan: { name: "Pro", key: "pro" },
    isLoading: false,
    can: mockCan,
    hasModule: mockHasModule,
  }),
  PermissionsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/usePageTitle", () => ({
  usePageTitle: vi.fn(),
}));

vi.mock("@/hooks/useEscapeClose", () => ({ useEscapeClose: vi.fn() }));

vi.mock("@/hooks/use-breakpoint", () => ({
  useBreakpoint: () => true,
}));

// Mock useModuleReadiness to return a controllable map
const mockModuleReadiness: Record<string, any> = {};
vi.mock("@/hooks/useModuleReadiness", () => ({
  useModuleReadiness: () => mockModuleReadiness,
}));

vi.mock("@/components/shared/LoadingState", () => ({
  LoadingState: (props: Record<string, unknown>) => (
    <div data-testid="loading-state" data-type={props.type}>Loading...</div>
  ),
}));

vi.mock("@/components/ui/glowing-effect", () => ({
  GlowingEffect: () => null,
}));

vi.mock("@/components/ui/canvas-reveal-effect", () => ({
  CanvasRevealEffect: () => null,
}));

vi.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/foundations/ez-icon", () => ({
  EzIcon: () => <span data-testid="ez-icon" />,
}));

vi.mock("@/lib/countryFlags", () => ({
  getCountryFlag: (loc: string) => `[${loc}]`,
  getLanguageFlag: (lang: string) => `[${lang}]`,
}));

// Override the global next-intl mock to include NextIntlClientProvider
vi.mock("next-intl", async () => {
  const actual = await vi.importActual<typeof import("next-intl")>("next-intl");
  return { ...actual };
});

vi.mock("motion/react", () => {
  const Component = ({ children, ...props }: Record<string, unknown>) => {
    const domSafe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      if (["className", "style", "id", "role", "onClick", "data-testid"].includes(k)) domSafe[k] = v;
    }
    return <div {...domSafe}>{children as React.ReactNode}</div>;
  };
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

// ---------------------------------------------------------------------------
// Mock ALL tab content components to prevent deep rendering
// ---------------------------------------------------------------------------

vi.mock("@/components/domain/sections/MonitoringStats", () => ({
  MonitoringStats: () => <div data-testid="monitoring-stats">MonitoringStats</div>,
}));
vi.mock("@/components/domain/tables/KeywordMonitoringTable", () => ({
  KeywordMonitoringTable: () => <div data-testid="keyword-monitoring-table">KeywordMonitoringTable</div>,
}));
vi.mock("@/components/domain/charts/PositionDistributionChart", () => ({
  PositionDistributionChart: () => <div data-testid="position-distribution-chart">PositionDistributionChart</div>,
}));
vi.mock("@/components/domain/charts/MovementTrendChart", () => ({
  MovementTrendChart: () => <div data-testid="movement-trend-chart">MovementTrendChart</div>,
}));
vi.mock("@/components/domain/badges/LiveBadge", () => ({
  LiveBadge: () => <span data-testid="live-badge">Live</span>,
}));
vi.mock("@/components/domain/sections/VisibilityStats", () => ({
  VisibilityStats: () => <div data-testid="visibility-stats">VisibilityStats</div>,
}));
vi.mock("@/components/domain/tables/TopKeywordsTable", () => ({
  TopKeywordsTable: () => <div data-testid="top-keywords-table">TopKeywordsTable</div>,
}));
vi.mock("@/components/domain/tables/AllKeywordsTable", () => ({
  AllKeywordsTable: () => <div data-testid="all-keywords-table">AllKeywordsTable</div>,
}));
vi.mock("@/components/domain/tables/DiscoveredKeywordsTable", () => ({
  DiscoveredKeywordsTable: () => <div data-testid="discovered-keywords-table">DiscoveredKeywordsTable</div>,
}));
vi.mock("@/components/domain/sections/Top10KeywordsSection", () => ({
  Top10KeywordsSection: () => <div data-testid="top10-keywords-section">Top10KeywordsSection</div>,
}));
vi.mock("@/components/domain/sections/BacklinksSummaryStats", () => ({
  BacklinksSummaryStats: () => <div data-testid="backlinks-summary-stats">BacklinksSummaryStats</div>,
}));
vi.mock("@/components/domain/charts/PlatformTypesChart", () => ({
  PlatformTypesChart: () => <div data-testid="platform-types-chart">PlatformTypesChart</div>,
}));
vi.mock("@/components/domain/charts/LinkAttributesChart", () => ({
  LinkAttributesChart: () => <div data-testid="link-attributes-chart">LinkAttributesChart</div>,
}));
vi.mock("@/components/domain/charts/BacklinksHistoryChart", () => ({
  BacklinksHistoryChart: () => <div data-testid="backlinks-history-chart">BacklinksHistoryChart</div>,
}));
vi.mock("@/components/domain/tables/TLDDistributionTable", () => ({
  TLDDistributionTable: () => <div data-testid="tld-distribution-table">TLDDistributionTable</div>,
}));
vi.mock("@/components/domain/tables/CountriesDistributionTable", () => ({
  CountriesDistributionTable: () => <div data-testid="countries-distribution-table">CountriesDistributionTable</div>,
}));
vi.mock("@/components/domain/tables/BacklinksTable", () => ({
  BacklinksTable: () => <div data-testid="backlinks-table">BacklinksTable</div>,
}));
vi.mock("@/components/domain/charts/BacklinkVelocityChart", () => ({
  BacklinkVelocityChart: () => <div data-testid="backlink-velocity-chart">BacklinkVelocityChart</div>,
}));
vi.mock("@/components/domain/cards/VelocityMetricsCards", () => ({
  VelocityMetricsCards: () => <div data-testid="velocity-metrics-cards">VelocityMetricsCards</div>,
}));
vi.mock("@/components/domain/sections/OnSiteSection", () => ({
  OnSiteSection: () => <div data-testid="onsite-section">OnSiteSection</div>,
}));
vi.mock("@/components/domain/sections/CompetitorManagementSection", () => ({
  CompetitorManagementSection: () => <div data-testid="competitor-management">CompetitorManagement</div>,
}));
vi.mock("@/components/domain/sections/CompetitorBacklinksSection", () => ({
  CompetitorBacklinksSection: () => <div data-testid="competitor-backlinks">CompetitorBacklinks</div>,
}));
vi.mock("@/components/domain/sections/CompetitorContentAnalysisSection", () => ({
  CompetitorContentAnalysisSection: () => <div data-testid="competitor-content">CompetitorContent</div>,
}));
vi.mock("@/components/domain/modals/AddKeywordsModal", () => ({
  AddKeywordsModal: () => null,
}));
vi.mock("@/components/domain/charts/CompetitorOverviewChart", () => ({
  CompetitorOverviewChart: () => <div data-testid="competitor-overview-chart">CompetitorOverviewChart</div>,
}));
vi.mock("@/components/domain/charts/CompetitorPositionScatterChart", () => ({
  CompetitorPositionScatterChart: () => <div data-testid="competitor-scatter-chart">CompetitorScatter</div>,
}));
vi.mock("@/components/domain/charts/CompetitorKeywordBarsChart", () => ({
  CompetitorKeywordBarsChart: () => <div data-testid="competitor-keyword-bars">CompetitorKeywordBars</div>,
}));
vi.mock("@/components/domain/charts/CompetitorBacklinkRadarChart", () => ({
  CompetitorBacklinkRadarChart: () => <div data-testid="competitor-backlink-radar">CompetitorBacklinkRadar</div>,
}));
vi.mock("@/components/domain/charts/BacklinkQualityComparisonChart", () => ({
  BacklinkQualityComparisonChart: () => <div data-testid="backlink-quality-comparison">BacklinkQualityComparison</div>,
}));
vi.mock("@/components/domain/tables/CompetitorKeywordGapTable", () => ({
  CompetitorKeywordGapTable: () => <div data-testid="competitor-gap-table">CompetitorGapTable</div>,
}));
vi.mock("@/components/domain/sections/KeywordMapSection", () => ({
  KeywordMapSection: () => <div data-testid="keyword-map-section">KeywordMapSection</div>,
}));
vi.mock("@/components/domain/sections/BacklinkProfileSection", () => ({
  BacklinkProfileSection: () => <div data-testid="backlink-profile-section">BacklinkProfile</div>,
}));
vi.mock("@/components/domain/sections/LinkBuildingSection", () => ({
  LinkBuildingSection: () => <div data-testid="link-building-section">LinkBuildingSection</div>,
}));
vi.mock("@/components/domain/sections/ContentGapSection", () => ({
  ContentGapSection: () => <div data-testid="content-gap-section">ContentGapSection</div>,
}));
vi.mock("@/components/domain/sections/InsightsSection", () => ({
  InsightsSection: () => <div data-testid="insights-section">InsightsSection</div>,
}));
vi.mock("@/components/domain/modals/GenerateReportModal", () => ({
  GenerateReportModal: () => null,
}));
vi.mock("@/components/domain/onboarding/DomainSetupWizard", () => ({
  DomainSetupWizard: () => null,
}));
vi.mock("@/components/domain/onboarding/OnboardingChecklist", () => ({
  OnboardingChecklist: () => <div data-testid="onboarding-checklist">OnboardingChecklist</div>,
}));
vi.mock("@/components/domain/sections/AIKeywordResearchSection", () => ({
  AIKeywordResearchSection: () => <div data-testid="ai-research-section">AIKeywordResearch</div>,
}));
vi.mock("@/components/domain/sections/StrategySection", () => ({
  StrategySection: () => <div data-testid="strategy-section">StrategySection</div>,
}));
vi.mock("@/components/domain/sections/DiagnosticSection", () => ({
  DiagnosticSection: () => <div data-testid="diagnostic-section">DiagnosticSection</div>,
}));
vi.mock("@/components/domain/sections/GeneratorsSection", () => ({
  GeneratorsSection: () => <div data-testid="generators-section">GeneratorsSection</div>,
}));
vi.mock("@/components/domain/sections/CompetitorAnalysisReportsSection", () => ({
  CompetitorAnalysisReportsSection: () => <div data-testid="competitor-analysis-reports">CompetitorAnalysisReports</div>,
}));
vi.mock("@/components/domain/modals/ShareLinkDialog", () => ({
  ShareLinkDialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/application/modals/delete-confirmation-dialog", () => ({
  DeleteConfirmationDialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/domain/cards/ModuleHubCard", () => ({
  ModuleHubCard: ({ title, tabId }: { title: string; tabId: string }) => (
    <div data-testid={`hub-card-${tabId}`}>{title}</div>
  ),
}));
vi.mock("@/components/application/metrics/metrics", () => ({
  MetricsChart04: () => null,
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useQuery, useMutation, useAction } from "convex/react";
import { renderWithProviders } from "@/test/helpers/render-with-providers";
import DomainDetailPage from "@/app/(dashboard)/domains/[domainId]/page";

// ---------------------------------------------------------------------------
// Query mock helper using getFunctionName for stable keys
// ---------------------------------------------------------------------------

type QueryMap = Record<string, unknown>;

function setupQueryMock(queryResponses: QueryMap) {
  vi.mocked(useQuery).mockImplementation(((ref: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    try {
      const name = getFunctionName(ref as any);
      if (name in queryResponses) return queryResponses[name];
    } catch {
      // not a valid function reference
    }
    return undefined;
  }) as any);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DOMAIN = {
  _id: "domain_1",
  _creationTime: Date.now(),
  domain: "example.com",
  projectId: "proj_1",
  tags: ["seo", "main"],
  settings: {
    location: "US",
    language: "en",
    searchEngine: "google",
    refreshFrequency: "daily",
  },
};

const KEYWORDS = [
  { _id: "kw_1", phrase: "test keyword", domainId: "domain_1" },
];

const PROJECTS = [{ _id: "proj_1", name: "Main Project" }];

const ONBOARDING_COMPLETE = {
  isCompleted: true,
  isDismissed: false,
  steps: {
    keywordsMonitored: true,
    serpChecked: true,
    competitorsAdded: true,
    analysisComplete: true,
    businessContextSet: true,
  },
  counts: {
    monitoredKeywords: 10,
    activeCompetitors: 3,
    contentGaps: 5,
  },
};

const ONBOARDING_INCOMPLETE = {
  isCompleted: false,
  isDismissed: false,
  steps: {
    keywordsMonitored: false,
    serpChecked: false,
    competitorsAdded: false,
    analysisComplete: false,
    businessContextSet: false,
  },
  counts: {
    monitoredKeywords: 0,
    activeCompetitors: 0,
    contentGaps: 0,
  },
};

const STRATEGY_ACTIVE = {
  status: "completed",
  strategy: {
    actionPlan: [{ title: "a" }, { title: "b" }],
    actionableSteps: [{ title: "c" }],
  },
  taskStatuses: [{ completed: true }],
  stepStatuses: [{ completed: false }],
};

/** Default module readiness — all visible, none locked */
function setDefaultModuleReadiness() {
  const tabs = [
    "overview", "monitoring", "keyword-map", "visibility", "backlinks",
    "link-building", "competitors", "content-gaps", "keyword-analysis",
    "on-site", "insights", "ai-research", "strategy", "generators", "settings",
  ];
  for (const t of tabs) {
    mockModuleReadiness[t] = { visible: true, locked: false, lockReason: "", status: "ready" };
  }
}

function clearModuleReadiness() {
  for (const key of Object.keys(mockModuleReadiness)) {
    delete mockModuleReadiness[key];
  }
}

/** Standard query responses for a fully loaded page */
function baseQueries(overrides: QueryMap = {}): QueryMap {
  return {
    "domains:getDomain": DOMAIN,
    "keywords:getKeywords": KEYWORDS,
    "projects:list": PROJECTS,
    "onboarding:getOnboardingStatus": ONBOARDING_COMPLETE,
    "admin:checkIsSuperAdmin": false,
    "aiStrategy:getActiveStrategy": null,
    "domains:getVisibilityStats": null,
    "domains:getTopKeywords": [],
    "backlinks:getBacklinkSummary": null,
    "backlinks:isBacklinkDataStale": false,
    "backlinks:getBacklinkDistributions": null,
    "backlinks:getBacklinks": null,
    "backlinkVelocity:getVelocityHistory": [],
    "backlinkVelocity:getVelocityStats": null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.mocked(useQuery).mockImplementation((() => undefined) as any);
  vi.mocked(useMutation).mockReturnValue(vi.fn() as any);
  vi.mocked(useAction).mockReturnValue(vi.fn() as any);
  mockHasModule.mockReturnValue(true);
  mockCan.mockReturnValue(true);
  clearModuleReadiness();
  setDefaultModuleReadiness();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DomainDetailPage", () => {
  // 1. Loading state
  it("shows loading state when domain is undefined", () => {
    // useQuery returns undefined by default (no setupQueryMock called)
    renderWithProviders(<DomainDetailPage />);

    expect(screen.getByTestId("loading-state")).toBeInTheDocument();
  });

  // 2. Domain not found
  it("shows domain not found message when domain is null", () => {
    setupQueryMock(baseQueries({ "domains:getDomain": null }));

    renderWithProviders(<DomainDetailPage />);

    expect(screen.getByText("Domain not found")).toBeInTheDocument();
    expect(screen.getByText("Back to Domains")).toBeInTheDocument();
  });

  // 3. Header renders domain name
  it("renders domain name in the header", () => {
    setupQueryMock(baseQueries());

    renderWithProviders(<DomainDetailPage />);

    // Domain name appears in breadcrumbs and h1; verify at least one
    const domainNames = screen.getAllByText("example.com");
    expect(domainNames.length).toBeGreaterThanOrEqual(1);
    // Verify it's in the h1 heading
    const heading = domainNames.find((el) => el.tagName === "H1");
    expect(heading).toBeTruthy();
  });

  // 4. Header renders domain metadata
  it("renders domain metadata: location, language, search engine, refresh frequency", () => {
    setupQueryMock(baseQueries());

    renderWithProviders(<DomainDetailPage />);

    // The metadata line contains location, language, searchEngine, refreshFrequency
    // Rendered as: [US] US · [en] en · google · daily
    expect(screen.getByText(/\[US\].*US.*\[en\].*en.*google.*daily/)).toBeInTheDocument();
  });

  // 5. Default tabs rendered
  it("renders default tabs: Overview, Monitoring, Keyword Map, Visibility", () => {
    setupQueryMock(baseQueries());

    renderWithProviders(<DomainDetailPage />);

    expect(screen.getAllByText("Overview").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Monitoring").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Keyword Map").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Visibility").length).toBeGreaterThanOrEqual(1);
  });

  // 6. Module-gated tabs hidden when module not available
  it("hides Backlinks tab when hasModule('backlinks') returns false", () => {
    mockHasModule.mockImplementation((mod: string) => mod !== "backlinks");
    setupQueryMock(baseQueries());

    renderWithProviders(<DomainDetailPage />);

    // Backlinks tab should not be in the tab list
    expect(screen.queryByRole("tab", { name: /Backlinks/i })).not.toBeInTheDocument();
  });

  // 7. Module-gated tabs visible when module available
  it("shows Backlinks tab when hasModule('backlinks') returns true", () => {
    mockHasModule.mockReturnValue(true);
    setupQueryMock(baseQueries());

    renderWithProviders(<DomainDetailPage />);

    // Both desktop and mobile tab lists render tabs; at least one Backlinks tab
    expect(screen.getAllByText("Backlinks").length).toBeGreaterThanOrEqual(1);
  });

  // 8. Tab switching
  it("switches tab content when clicking a tab", async () => {
    const user = userEvent.setup();
    setupQueryMock(baseQueries());

    renderWithProviders(<DomainDetailPage />);

    // Overview tab is default — no monitoring-specific content yet
    // Click the Settings tab
    const settingsTabs = screen.getAllByText("Settings");
    // Pick the first one (desktop sidebar)
    await user.click(settingsTabs[0]);

    // Settings panel content should be visible (the "Settings" heading inside the panel)
    expect(screen.getByText("Search Engine")).toBeInTheDocument();
    expect(screen.getByText("Refresh Frequency")).toBeInTheDocument();
  });

  // 9. Onboarding incomplete — shows overlay
  it("shows onboarding overlay when isCompleted is false", () => {
    setupQueryMock(baseQueries({
      "onboarding:getOnboardingStatus": ONBOARDING_INCOMPLETE,
    }));

    renderWithProviders(<DomainDetailPage />);

    expect(screen.getByText("Complete Setup First")).toBeInTheDocument();
    expect(screen.getByText("Start Setup")).toBeInTheDocument();
  });

  // 10. Onboarding complete — no overlay
  it("does not show onboarding overlay when isCompleted is true", () => {
    setupQueryMock(baseQueries());

    renderWithProviders(<DomainDetailPage />);

    expect(screen.queryByText("Complete Setup First")).not.toBeInTheDocument();
    expect(screen.queryByText("Start Setup")).not.toBeInTheDocument();
  });

  // 11. Action buttons disabled when onboarding incomplete
  it("disables action buttons when onboarding is incomplete", () => {
    setupQueryMock(baseQueries({
      "onboarding:getOnboardingStatus": ONBOARDING_INCOMPLETE,
    }));

    renderWithProviders(<DomainDetailPage />);

    // When onboarding is incomplete, disabled ButtonUtility icons are rendered
    // They have isDisabled prop. We check that the enabled action buttons
    // (edit, delete, refresh) are NOT rendered — instead disabled versions are shown.
    // The PermissionGate-wrapped buttons won't appear; instead we get the
    // disabled alternatives.
    const allButtons = screen.getAllByRole("button");
    const disabledButtons = allButtons.filter((btn) => btn.hasAttribute("disabled") || btn.getAttribute("aria-disabled") === "true");
    expect(disabledButtons.length).toBeGreaterThanOrEqual(1);
  });

  // 12. Action buttons enabled when onboarding complete
  it("renders action buttons when onboarding is complete", () => {
    setupQueryMock(baseQueries());

    renderWithProviders(<DomainDetailPage />);

    // With onboarding complete, the PermissionGate-wrapped buttons render.
    // Look for tooltip-bearing buttons. The share, report, refresh, edit, delete
    // buttons are all rendered via ButtonUtility with tooltips.
    // Since mockCan returns true, all are rendered.
    expect(screen.queryByText("Complete Setup First")).not.toBeInTheDocument();

    // At minimum the Breadcrumbs and action buttons are present
    const allButtons = screen.getAllByRole("button");
    expect(allButtons.length).toBeGreaterThanOrEqual(5);
  });

  // 13. Diagnostics tab only for superadmin
  it("shows Diagnostics tab when user is super admin", () => {
    setupQueryMock(baseQueries({
      "admin:checkIsSuperAdmin": true,
    }));

    renderWithProviders(<DomainDetailPage />);

    expect(screen.getAllByText("Diagnostics").length).toBeGreaterThanOrEqual(1);
  });

  it("hides Diagnostics tab when user is not super admin", () => {
    setupQueryMock(baseQueries({
      "admin:checkIsSuperAdmin": false,
    }));

    renderWithProviders(<DomainDetailPage />);

    expect(screen.queryByText("Diagnostics")).not.toBeInTheDocument();
  });

  // 14. Strategy tab badge
  it("shows strategy badge with task count when active strategy exists", () => {
    setupQueryMock(baseQueries({
      "aiStrategy:getActiveStrategy": STRATEGY_ACTIVE,
    }));

    renderWithProviders(<DomainDetailPage />);

    // Badge shows "1/3" (1 completed task out of 2 actionPlan + 1 actionableStep)
    expect(screen.getAllByText("1/3").length).toBeGreaterThanOrEqual(1);
  });

  // 15. Competitors tab hidden when competitors module disabled
  it("hides Competitors and Content Gaps tabs when competitors module is disabled", () => {
    mockHasModule.mockImplementation((mod: string) => mod !== "competitors");
    setupQueryMock(baseQueries());

    renderWithProviders(<DomainDetailPage />);

    expect(screen.queryByRole("tab", { name: /^Competitors$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Content Gaps/i })).not.toBeInTheDocument();
  });
});
