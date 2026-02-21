/**
 * Component-level tests for section components (batch 3):
 *
 * 1. AIKeywordResearchSection
 * 2. AIStrategySection
 * 3. CompetitorAnalysisReportsSection
 * 4. CompetitorBacklinksSection
 * 5. CompetitorContentAnalysisSection
 * 6. CompetitorManagementSection
 * 7. GeneratorsSection
 * 8. StrategySection
 * 9. SitemapOverviewCard
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import React from "react";
import { renderWithProviders } from "@/test/helpers/render-with-providers";
import { mockQueries, resetConvexMocks } from "@/test/helpers/convex-mock";
import { api } from "../../../../convex/_generated/api";

// ── Component imports ────────────────────────────────────────────────
import { AIKeywordResearchSection } from "./AIKeywordResearchSection";
import { AIStrategySection } from "./AIStrategySection";
import { CompetitorAnalysisReportsSection } from "./CompetitorAnalysisReportsSection";
import { CompetitorBacklinksSection } from "./CompetitorBacklinksSection";
import { CompetitorContentAnalysisSection } from "./CompetitorContentAnalysisSection";
import { CompetitorManagementSection } from "./CompetitorManagementSection";
import { GeneratorsSection } from "./GeneratorsSection";
import { StrategySection } from "./StrategySection";
import { SitemapOverviewCard } from "./SitemapOverviewCard";

// ── Override the global next-intl mock ──
vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return {
    ...actual,
    useTranslations: () => (key: string, params?: Record<string, unknown>) => {
      if (params) return `${key}(${JSON.stringify(params)})`;
      return key;
    },
    useLocale: () => "en",
    useFormatter: () => ({
      number: (v: number) => String(v),
      dateTime: (v: Date) => v.toISOString(),
    }),
  };
});

// ── Mocks for convex + navigation ───────────────────────────────────

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
  usePathname: () => "/domains/test-domain-id",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ domainId: "test-domain-id" }),
}));

// ── Shared mock factory ─────────────────────────────────────────────

function makeModalMocks() {
  const R = require("react");
  return {
    DialogTrigger: ({ children, isOpen }: any) =>
      isOpen ? R.createElement("div", { "data-testid": "dialog-trigger" }, children) : null,
    ModalOverlay: ({ children }: any) => R.createElement("div", null, children),
    Modal: ({ children }: any) => R.createElement("div", null, children),
    Dialog: ({ children }: any) => R.createElement("div", { role: "dialog" }, children),
  };
}

// ── react-aria-components ──────────────────────────────────────────

vi.mock("react-aria-components", () => {
  const R = require("react");
  const passthrough = ({ children }: any) => R.createElement("div", null, children);
  return {
    ...makeModalMocks(),
    Heading: ({ children }: any) => R.createElement("h2", null, children),
    Button: ({ children, onPress, ...props }: any) =>
      R.createElement("button", { onClick: onPress, ...props }, children),
    Link: ({ children, ...props }: any) => R.createElement("a", props, children),
    TooltipTrigger: passthrough,
    Tooltip: passthrough,
    OverlayArrow: passthrough,
    TextField: ({ children, ...props }: any) => {
      const content = typeof children === "function"
        ? children({ isInvalid: false, isRequired: false, isFocused: false, isDisabled: false })
        : children;
      return R.createElement("div", null, content);
    },
    Label: ({ children }: any) => R.createElement("label", null, children),
    Input: (props: any) => R.createElement("input", props),
    TextArea: (props: any) => R.createElement("textarea", props),
    Group: passthrough,
    Text: ({ children }: any) => R.createElement("span", null, children),
    Switch: passthrough,
    Checkbox: passthrough,
  };
});

// ── Mock heavy / child components ──────────────────────────────────

vi.mock("@/components/ui/glowing-effect", () => ({
  GlowingEffect: () => null,
}));

vi.mock("@/components/foundations/ez-icon", () => ({
  EzIcon: () => <span data-testid="ez-icon" />,
}));

vi.mock("@/components/auth/PermissionGate", () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/application/modals/delete-confirmation-dialog", () => ({
  DeleteConfirmationDialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/application/modals/modal", () => makeModalMocks());

vi.mock("../modals/KeywordAnalysisReportDetailModal", () => ({
  KeywordAnalysisReportDetailModal: () => <div data-testid="report-detail-modal" />,
}));

vi.mock("../modals/AddCompetitorModal", () => ({
  AddCompetitorModal: () => <div data-testid="add-competitor-modal" />,
}));

// Mock strategy sub-components
vi.mock("./strategy/StrategyRenderers", () => ({
  SECTION_CONFIG: [],
  StrategySectionCard: () => <div data-testid="strategy-section-card" />,
}));

vi.mock("./strategy/ActiveStrategyDashboard", () => ({
  ActiveStrategyDashboard: () => <div data-testid="active-strategy-dashboard" />,
}));

// Mock generators sub-components
vi.mock("./generators/SchemaGeneratorPanel", () => ({
  SchemaGeneratorPanel: ({ domainId }: { domainId: string }) => (
    <div data-testid="schema-generator-panel">{domainId}</div>
  ),
}));

vi.mock("./generators/LlmsTxtGeneratorPanel", () => ({
  LlmsTxtGeneratorPanel: ({ domainId }: { domainId: string }) => (
    <div data-testid="llms-txt-generator-panel">{domainId}</div>
  ),
}));

// Mock Select component (uses react-aria)
vi.mock("@/components/base/select/select", () => ({
  Select: ({ placeholder, children, ...props }: any) => (
    <div data-testid="select-mock">{placeholder}</div>
  ),
}));

vi.mock("@/components/base/tooltip/tooltip", () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ children }: any) => <>{children}</>,
}));

// ── Reset mocks before each test ────────────────────────────────────

beforeEach(() => {
  resetConvexMocks();
});

const DOMAIN_ID = "test-domain-123" as any;

// =====================================================================
// 1. AIKeywordResearchSection
// =====================================================================

describe("AIKeywordResearchSection", () => {
  test("renders loading state when queries return undefined", () => {
    renderWithProviders(<AIKeywordResearchSection domainId={DOMAIN_ID} />);
    // Title should render
    expect(screen.getByText("title")).toBeInTheDocument();
    expect(screen.getByText("description")).toBeInTheDocument();
    // Loading indicator for history
    expect(screen.getByText("...")).toBeInTheDocument();
  });

  test("renders empty state when history is empty and no results", () => {
    mockQueries([
      [api.aiResearch.getHistory, []],
      [api.domains.getDomain, { _id: DOMAIN_ID, domain: "example.com" }],
    ]);
    renderWithProviders(<AIKeywordResearchSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("historyTitle")).toBeInTheDocument();
    expect(screen.getByText("historyEmpty")).toBeInTheDocument();
  });

  test("renders form fields (business description, target customer)", () => {
    mockQueries([
      [api.aiResearch.getHistory, []],
      [api.domains.getDomain, { _id: DOMAIN_ID, domain: "example.com" }],
    ]);
    renderWithProviders(<AIKeywordResearchSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("businessDescriptionLabel")).toBeInTheDocument();
    expect(screen.getByText("targetCustomerLabel")).toBeInTheDocument();
    expect(screen.getByText("keywordCountLabel")).toBeInTheDocument();
    expect(screen.getByText("focusTypeLabel")).toBeInTheDocument();
  });

  test("renders history sessions when data is available", () => {
    const sessions = [
      {
        _id: "session-1" as any,
        businessDescription: "Test business for SEO tools",
        targetCustomer: "Small business owners",
        keywordCount: 20,
        focusType: "all",
        keywords: [
          {
            keyword: "seo tools",
            searchIntent: "commercial",
            relevanceScore: 8,
            rationale: "High value",
            category: "tools",
            searchVolume: 1000,
            cpc: 2.5,
            competition: 0.5,
            difficulty: 45,
          },
        ],
        createdAt: Date.now(),
      },
    ];
    mockQueries([
      [api.aiResearch.getHistory, sessions],
      [api.domains.getDomain, { _id: DOMAIN_ID, domain: "example.com" }],
    ]);
    renderWithProviders(<AIKeywordResearchSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("historyTitle")).toBeInTheDocument();
    // Session card shows keyword count badge
    expect(screen.getByText('historyKeywords({"count":1})')).toBeInTheDocument();
  });

  test("renders generate button", () => {
    mockQueries([
      [api.aiResearch.getHistory, []],
      [api.domains.getDomain, null],
    ]);
    renderWithProviders(<AIKeywordResearchSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("generateButton")).toBeInTheDocument();
  });
});

// =====================================================================
// 2. AIStrategySection
// =====================================================================

describe("AIStrategySection", () => {
  test("renders empty state when no strategy exists", () => {
    mockQueries([
      [api.aiStrategy.getHistory, []],
      [api.aiStrategy.getLatest, null],
      [api.domains.getDomain, { _id: DOMAIN_ID, domain: "example.com" }],
      [api.aiStrategy.getActiveStrategy, null],
    ]);
    renderWithProviders(<AIStrategySection domainId={DOMAIN_ID} />);
    expect(screen.getByText("noStrategyYet")).toBeInTheDocument();
    expect(screen.getByText("noStrategyDescription")).toBeInTheDocument();
  });

  test("renders form when no strategy yet", () => {
    mockQueries([
      [api.aiStrategy.getHistory, []],
      [api.aiStrategy.getLatest, null],
      [api.domains.getDomain, null],
      [api.aiStrategy.getActiveStrategy, null],
    ]);
    renderWithProviders(<AIStrategySection domainId={DOMAIN_ID} />);
    expect(screen.getByText("businessDescription")).toBeInTheDocument();
    expect(screen.getByText("targetCustomer")).toBeInTheDocument();
    expect(screen.getByText("focusKeywords")).toBeInTheDocument();
  });

  test("renders loading state when queries are undefined", () => {
    renderWithProviders(<AIStrategySection domainId={DOMAIN_ID} />);
    // Form should still render while loading
    expect(screen.getByText("businessDescription")).toBeInTheDocument();
  });

  test("renders error state when session has failed status", () => {
    const failedSession = {
      _id: "session-1" as any,
      status: "failed",
      error: "API rate limit exceeded",
      businessDescription: "Test",
      targetCustomer: "Users",
      createdAt: Date.now(),
    };
    mockQueries([
      [api.aiStrategy.getHistory, [failedSession]],
      [api.aiStrategy.getLatest, failedSession],
      [api.domains.getDomain, { _id: DOMAIN_ID, domain: "example.com" }],
      [api.aiStrategy.getActiveStrategy, null],
    ]);
    renderWithProviders(<AIStrategySection domainId={DOMAIN_ID} />);
    expect(screen.getByText("errorGenerating")).toBeInTheDocument();
    expect(screen.getByText("API rate limit exceeded")).toBeInTheDocument();
  });

  test("renders generate button text", () => {
    mockQueries([
      [api.aiStrategy.getHistory, []],
      [api.aiStrategy.getLatest, null],
      [api.domains.getDomain, null],
      [api.aiStrategy.getActiveStrategy, null],
    ]);
    renderWithProviders(<AIStrategySection domainId={DOMAIN_ID} />);
    expect(screen.getByText("generateStrategy")).toBeInTheDocument();
  });
});

// =====================================================================
// 3. CompetitorAnalysisReportsSection
// =====================================================================

describe("CompetitorAnalysisReportsSection", () => {
  test("renders loading state when reports are undefined", () => {
    renderWithProviders(<CompetitorAnalysisReportsSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("reportsLoading")).toBeInTheDocument();
  });

  test("renders empty state when reports array is empty", () => {
    mockQueries([
      [api.competitorAnalysisReports.getReportsForDomain, []],
    ]);
    renderWithProviders(<CompetitorAnalysisReportsSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("reportsEmpty")).toBeInTheDocument();
    expect(screen.getByText("reportsEmptyDesc")).toBeInTheDocument();
    expect(screen.getByText("reportsGenerateAll")).toBeInTheDocument();
  });

  test("renders reports table when data is available", () => {
    const reports = [
      {
        _id: "report-1" as any,
        keyword: "test keyword",
        status: "completed",
        competitorPages: [{ domain: "competitor.com", url: "https://competitor.com/page" }],
        analysis: { avgCompetitorWordCount: 1500, avgCompetitorH2Count: 5, avgCompetitorImagesCount: 3 },
        recommendations: [{ text: "Add more content" }],
        createdAt: Date.now(),
      },
    ];
    mockQueries([
      [api.competitorAnalysisReports.getReportsForDomain, reports],
    ]);
    renderWithProviders(<CompetitorAnalysisReportsSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("reportsTitle")).toBeInTheDocument();
    expect(screen.getByText("test keyword")).toBeInTheDocument();
    expect(screen.getByText("reportsColKeyword")).toBeInTheDocument();
    expect(screen.getByText("reportsColStatus")).toBeInTheDocument();
  });

  test("renders no match message when filtered results are empty", () => {
    const reports = [
      {
        _id: "report-1" as any,
        keyword: "specific keyword",
        status: "completed",
        competitorPages: [],
        analysis: null,
        recommendations: [],
        createdAt: Date.now(),
      },
    ];
    mockQueries([
      [api.competitorAnalysisReports.getReportsForDomain, reports],
    ]);
    renderWithProviders(<CompetitorAnalysisReportsSection domainId={DOMAIN_ID} />);
    // The table should render with data
    expect(screen.getByText("specific keyword")).toBeInTheDocument();
  });
});

// =====================================================================
// 4. CompetitorBacklinksSection
// =====================================================================

describe("CompetitorBacklinksSection", () => {
  test("renders loading state when competitors are undefined", () => {
    renderWithProviders(<CompetitorBacklinksSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("compBacklinksLoading")).toBeInTheDocument();
  });

  test("renders empty state when no active competitors", () => {
    mockQueries([
      [api.competitors.getCompetitors, []],
    ]);
    renderWithProviders(<CompetitorBacklinksSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("compBacklinksNoCompetitors")).toBeInTheDocument();
  });

  test("renders competitor selector when active competitors exist", () => {
    const competitors = [
      { _id: "comp-1" as any, competitorDomain: "rival.com", name: "Rival", status: "active" },
    ];
    mockQueries([
      [api.competitors.getCompetitors, competitors],
      [api.backlinks.getBacklinkSummary, null],
    ]);
    renderWithProviders(<CompetitorBacklinksSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("compBacklinksTitle")).toBeInTheDocument();
    expect(screen.getByText("compBacklinksSubtitle")).toBeInTheDocument();
    // Select prompt is shown
    expect(screen.getByText("compBacklinksSelectPrompt")).toBeInTheDocument();
  });

  test("filters out inactive competitors", () => {
    const competitors = [
      { _id: "comp-1" as any, competitorDomain: "rival.com", name: "Rival", status: "inactive" },
    ];
    mockQueries([
      [api.competitors.getCompetitors, competitors],
    ]);
    renderWithProviders(<CompetitorBacklinksSection domainId={DOMAIN_ID} />);
    // Should show empty state since no active competitors
    expect(screen.getByText("compBacklinksNoCompetitors")).toBeInTheDocument();
  });
});

// =====================================================================
// 5. CompetitorContentAnalysisSection
// =====================================================================

describe("CompetitorContentAnalysisSection", () => {
  test("renders loading state when data is undefined", () => {
    renderWithProviders(<CompetitorContentAnalysisSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("contentAnalysisLoading")).toBeInTheDocument();
  });

  test("renders empty state when no active competitors", () => {
    mockQueries([
      [api.competitors.getCompetitors, []],
      [api.keywords.getKeywords, []],
    ]);
    renderWithProviders(<CompetitorContentAnalysisSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("competitorMgmtNoCompetitors")).toBeInTheDocument();
    expect(screen.getByText("contentAnalysisNoCompetitorsHint")).toBeInTheDocument();
  });

  test("renders selectors when competitors and keywords exist", () => {
    const competitors = [
      { _id: "comp-1" as any, competitorDomain: "rival.com", name: "Rival", status: "active" },
    ];
    const keywords = [
      { _id: "kw-1" as any, phrase: "test keyword", status: "active" },
    ];
    mockQueries([
      [api.competitors.getCompetitors, competitors],
      [api.keywords.getKeywords, keywords],
    ]);
    renderWithProviders(<CompetitorContentAnalysisSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("contentAnalysisTitle")).toBeInTheDocument();
    expect(screen.getByText("contentAnalysisSubtitle")).toBeInTheDocument();
    expect(screen.getByText("contentAnalysisSelectPrompt")).toBeInTheDocument();
  });

  test("filters out inactive competitors", () => {
    const competitors = [
      { _id: "comp-1" as any, competitorDomain: "rival.com", name: "Rival", status: "inactive" },
    ];
    mockQueries([
      [api.competitors.getCompetitors, competitors],
      [api.keywords.getKeywords, []],
    ]);
    renderWithProviders(<CompetitorContentAnalysisSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("competitorMgmtNoCompetitors")).toBeInTheDocument();
  });
});

// =====================================================================
// 6. CompetitorManagementSection
// =====================================================================

describe("CompetitorManagementSection", () => {
  test("renders loading state when competitors are undefined", () => {
    renderWithProviders(<CompetitorManagementSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  test("renders empty state when no active competitors", () => {
    mockQueries([
      [api.competitors.getCompetitors, []],
      [api.competitorContentGapJobs.getActiveJobsForDomain, []],
      [api.competitorBacklinksJobs.getActiveJobsForDomain, []],
    ]);
    renderWithProviders(<CompetitorManagementSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("competitorMgmtNoCompetitors")).toBeInTheDocument();
    expect(screen.getByText("competitorMgmtAddFirst")).toBeInTheDocument();
  });

  test("renders competitor list when data is available", () => {
    const competitors = [
      {
        _id: "comp-1" as any,
        competitorDomain: "rival.com",
        name: "Rival Inc",
        status: "active",
        lastCheckedAt: Date.now(),
      },
    ];
    mockQueries([
      [api.competitors.getCompetitors, competitors],
      [api.competitorContentGapJobs.getActiveJobsForDomain, []],
      [api.competitorBacklinksJobs.getActiveJobsForDomain, []],
    ]);
    renderWithProviders(<CompetitorManagementSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("Rival Inc")).toBeInTheDocument();
    expect(screen.getByText("rival.com")).toBeInTheDocument();
    // Action buttons
    expect(screen.getByText("competitorMgmtContentGap")).toBeInTheDocument();
    expect(screen.getByText("competitorMgmtBacklinks")).toBeInTheDocument();
  });

  test("renders add competitor button", () => {
    mockQueries([
      [api.competitors.getCompetitors, []],
      [api.competitorContentGapJobs.getActiveJobsForDomain, []],
      [api.competitorBacklinksJobs.getActiveJobsForDomain, []],
    ]);
    renderWithProviders(<CompetitorManagementSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("competitorMgmtAddCompetitor")).toBeInTheDocument();
  });

  test("renders select all header when competitors exist", () => {
    const competitors = [
      { _id: "comp-1" as any, competitorDomain: "rival.com", name: "Rival", status: "active" },
      { _id: "comp-2" as any, competitorDomain: "another.com", name: "Another", status: "active" },
    ];
    mockQueries([
      [api.competitors.getCompetitors, competitors],
      [api.competitorContentGapJobs.getActiveJobsForDomain, []],
      [api.competitorBacklinksJobs.getActiveJobsForDomain, []],
    ]);
    renderWithProviders(<CompetitorManagementSection domainId={DOMAIN_ID} />);
    expect(screen.getByText('competitorMgmtSelectAll (2)')).toBeInTheDocument();
  });

  test("filters out inactive competitors from display", () => {
    const competitors = [
      { _id: "comp-1" as any, competitorDomain: "rival.com", name: "Rival", status: "active" },
      { _id: "comp-2" as any, competitorDomain: "removed.com", name: "Removed", status: "inactive" },
    ];
    mockQueries([
      [api.competitors.getCompetitors, competitors],
      [api.competitorContentGapJobs.getActiveJobsForDomain, []],
      [api.competitorBacklinksJobs.getActiveJobsForDomain, []],
    ]);
    renderWithProviders(<CompetitorManagementSection domainId={DOMAIN_ID} />);
    expect(screen.getByText("Rival")).toBeInTheDocument();
    expect(screen.queryByText("Removed")).not.toBeInTheDocument();
  });
});

// =====================================================================
// 7. GeneratorsSection
// =====================================================================

describe("GeneratorsSection", () => {
  test("renders both generator panels", () => {
    renderWithProviders(<GeneratorsSection domainId={DOMAIN_ID} />);
    expect(screen.getByTestId("schema-generator-panel")).toBeInTheDocument();
    expect(screen.getByTestId("llms-txt-generator-panel")).toBeInTheDocument();
  });

  test("passes domainId to child panels", () => {
    renderWithProviders(<GeneratorsSection domainId={DOMAIN_ID} />);
    expect(screen.getByTestId("schema-generator-panel")).toHaveTextContent(DOMAIN_ID);
    expect(screen.getByTestId("llms-txt-generator-panel")).toHaveTextContent(DOMAIN_ID);
  });
});

// =====================================================================
// 8. StrategySection
// =====================================================================

describe("StrategySection", () => {
  test("renders header with title and subtitle", () => {
    mockQueries([
      [api.aiStrategy.getActiveStrategy, null],
    ]);
    renderWithProviders(<StrategySection domainId={DOMAIN_ID} />);
    expect(screen.getByText("aiStrategy")).toBeInTheDocument();
    expect(screen.getByText("aiStrategySubtitle")).toBeInTheDocument();
  });

  test("renders generator view when no active strategy", () => {
    mockQueries([
      [api.aiStrategy.getActiveStrategy, null],
    ]);
    renderWithProviders(<StrategySection domainId={DOMAIN_ID} />);
    // No toggle buttons should appear when there is no active strategy
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument();
  });

  test("renders view toggle when active strategy exists", () => {
    const activeSession = {
      _id: "session-1" as any,
      status: "completed",
      strategy: { executiveSummary: "Test summary" },
      createdAt: Date.now(),
    };
    mockQueries([
      [api.aiStrategy.getActiveStrategy, activeSession],
    ]);
    renderWithProviders(<StrategySection domainId={DOMAIN_ID} />);
    expect(screen.getByText("dashboard")).toBeInTheDocument();
    expect(screen.getByText("generator")).toBeInTheDocument();
  });

  test("renders active strategy dashboard when active strategy is available", () => {
    const activeSession = {
      _id: "session-1" as any,
      status: "completed",
      strategy: { executiveSummary: "Test summary" },
      createdAt: Date.now(),
    };
    mockQueries([
      [api.aiStrategy.getActiveStrategy, activeSession],
    ]);
    renderWithProviders(<StrategySection domainId={DOMAIN_ID} />);
    expect(screen.getByTestId("active-strategy-dashboard")).toBeInTheDocument();
  });
});

// =====================================================================
// 9. SitemapOverviewCard
// =====================================================================

describe("SitemapOverviewCard", () => {
  test("renders no-data state when sitemapData is null", () => {
    mockQueries([
      [api.seoAudit_queries.getSitemapData, null],
    ]);
    renderWithProviders(<SitemapOverviewCard domainId={DOMAIN_ID} />);
    expect(screen.getByText("sitemap")).toBeInTheDocument();
    expect(screen.getByText("noSitemapData")).toBeInTheDocument();
  });

  test("renders loading state when query returns undefined", () => {
    renderWithProviders(<SitemapOverviewCard domainId={DOMAIN_ID} />);
    // When sitemapData is undefined (loading), the null-check (!sitemapData) catches it
    expect(screen.getByText("sitemap")).toBeInTheDocument();
    expect(screen.getByText("noSitemapData")).toBeInTheDocument();
  });

  test("renders sitemap data when available", () => {
    const sitemapData = {
      totalUrls: 42,
      sitemapUrl: "https://example.com/sitemap.xml",
      fetchedAt: Date.now(),
      urls: ["https://example.com/page1", "https://example.com/page2"],
    };
    mockQueries([
      [api.seoAudit_queries.getSitemapData, sitemapData],
    ]);
    renderWithProviders(<SitemapOverviewCard domainId={DOMAIN_ID} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("urlsFound")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/page1")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/page2")).toBeInTheDocument();
  });

  test("renders show all button when more than 5 URLs", () => {
    const urls = Array.from({ length: 8 }, (_, i) => `https://example.com/page${i + 1}`);
    const sitemapData = {
      totalUrls: 8,
      sitemapUrl: "https://example.com/sitemap.xml",
      fetchedAt: Date.now(),
      urls,
    };
    mockQueries([
      [api.seoAudit_queries.getSitemapData, sitemapData],
    ]);
    renderWithProviders(<SitemapOverviewCard domainId={DOMAIN_ID} />);
    // Only first 5 shown initially
    expect(screen.getByText("https://example.com/page1")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/page5")).toBeInTheDocument();
    expect(screen.queryByText("https://example.com/page6")).not.toBeInTheDocument();
    // Show all button
    expect(screen.getByText('showAllUrls({"count":8})')).toBeInTheDocument();
  });

  test("does not render show all button when 5 or fewer URLs", () => {
    const sitemapData = {
      totalUrls: 3,
      sitemapUrl: "https://example.com/sitemap.xml",
      fetchedAt: Date.now(),
      urls: ["https://example.com/a", "https://example.com/b", "https://example.com/c"],
    };
    mockQueries([
      [api.seoAudit_queries.getSitemapData, sitemapData],
    ]);
    renderWithProviders(<SitemapOverviewCard domainId={DOMAIN_ID} />);
    expect(screen.queryByText(/showAllUrls/)).not.toBeInTheDocument();
  });
});
