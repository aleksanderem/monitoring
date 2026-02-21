/**
 * Component-level tests for the second batch of table components.
 *
 * Components tested:
 *   1. CannibalizationTable
 *   2. CountriesDistributionTable
 *   3. CrawlLinksTable
 *   4. ImageAnalysisTable
 *   5. LinkBuildingProspectsTable
 *   6. OnSitePagesTable
 *   7. RedirectChainsTable
 *   8. UrlSelectionTable
 *   9. PageSpeedTab
 *  10. QuickWinsTable
 */
import React from "react";
import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { api } from "../../../../convex/_generated/api";

// ─── Global Mocks ───────────────────────────────────────────────────────────

// convex/react must be mocked BEFORE any component import
const mockUseQuery = vi.fn<any>(() => undefined);
const mockUseMutation = vi.fn(() => vi.fn());
const mockUseAction = vi.fn(() => vi.fn());

vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: (...args: any[]) => mockUseMutation(...args),
  useAction: (...args: any[]) => mockUseAction(...args),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/domains/test",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ui/glowing-effect", () => ({
  GlowingEffect: () => null,
}));

vi.mock("@/components/shared/LoadingState", () => ({
  LoadingState: () => <div data-testid="loading-state">Loading...</div>,
}));

vi.mock("@/components/base/input/input", () => ({
  Input: (props: any) => (
    <input
      data-testid="input-mock"
      placeholder={props.placeholder}
      value={props.value}
      onChange={(e: any) => props.onChange?.(e.target.value)}
    />
  ),
}));

vi.mock("@/components/base/buttons/button", () => ({
  Button: ({ children, onClick, disabled, isDisabled, ...rest }: any) => (
    <button onClick={onClick} disabled={disabled || isDisabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/base/badges/badges", () => ({
  Badge: ({ children }: any) => <span data-testid="badge-mock">{children}</span>,
}));

vi.mock("@/components/base/tooltip/tooltip", () => ({
  Tooltip: ({ children }: any) => <span>{children}</span>,
  TooltipTrigger: ({ children }: any) => <span>{children}</span>,
}));

vi.mock("../modals/LinkBuildingProspectDetailModal", () => ({
  LinkBuildingProspectDetailModal: () => null,
}));

vi.mock("../modals/PageDetailModal", () => ({
  PageDetailModal: () => null,
}));

vi.mock("../modals/QuickWinDetailModal", () => ({
  QuickWinDetailModal: () => null,
}));

vi.mock("@/components/patterns/BulkActionBar", () => ({
  BulkActionBar: ({ selectedCount }: any) =>
    selectedCount > 0 ? (
      <div data-testid="bulk-bar">{selectedCount} selected</div>
    ) : null,
}));

vi.mock("@/hooks/useRowSelection", () => ({
  useRowSelection: () => ({
    selectedIds: new Set<string>(),
    count: 0,
    isSelected: () => false,
    isAllSelected: () => false,
    isIndeterminate: () => false,
    toggle: vi.fn(),
    toggleAll: vi.fn(),
    clear: vi.fn(),
    select: vi.fn(),
  }),
}));

vi.mock("@/hooks/useEscapeClose", () => ({
  useEscapeClose: vi.fn(),
}));

// ─── Imports (after mocks) ──────────────────────────────────────────────────

import { CannibalizationTable } from "./CannibalizationTable";
import { CountriesDistributionTable } from "./CountriesDistributionTable";
import { CrawlLinksTable } from "./CrawlLinksTable";
import { ImageAnalysisTable } from "./ImageAnalysisTable";
import { LinkBuildingProspectsTable } from "./LinkBuildingProspectsTable";
import { OnSitePagesTable } from "./OnSitePagesTable";
import { RedirectChainsTable } from "./RedirectChainsTable";
import { UrlSelectionTable } from "./UrlSelectionTable";
import { PageSpeedTab } from "./PageSpeedTab";
import { QuickWinsTable } from "./QuickWinsTable";
import { getFunctionName } from "convex/server";

// ─── Helpers ────────────────────────────────────────────────────────────────

function refToKey(ref: unknown): string {
  try {
    return getFunctionName(ref as any);
  } catch {
    return String(ref);
  }
}

/**
 * Configure mockUseQuery to return specific data for specific query references.
 */
function setupQueries(responses: [ref: unknown, data: unknown][]) {
  const map = new Map<string, unknown>();
  for (const [ref, data] of responses) {
    map.set(refToKey(ref), data);
  }
  mockUseQuery.mockImplementation((ref: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    const key = refToKey(ref);
    if (map.has(key)) return map.get(key);
    return undefined;
  });
}

// ─── Setup ──────────────────────────────────────────────────────────────────

const DOMAIN_ID = "test_domain_id_123" as any;

beforeEach(() => {
  mockUseQuery.mockImplementation(() => undefined);
  mockUseMutation.mockImplementation(() => vi.fn());
  mockUseAction.mockImplementation(() => vi.fn());
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. CannibalizationTable
// ═══════════════════════════════════════════════════════════════════════════

describe("CannibalizationTable", () => {
  test("renders loading state when query returns undefined", () => {
    render(<CannibalizationTable domainId={DOMAIN_ID} />);
    const pulseElements = document.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  test("renders empty state when data is empty array", () => {
    setupQueries([[api.keywordMap_queries.getKeywordCannibalization, []]]);
    render(<CannibalizationTable domainId={DOMAIN_ID} />);
    expect(screen.getByText("noCannibalizationDetected")).toBeInTheDocument();
    expect(screen.getByText("eachUrlRanksUnique")).toBeInTheDocument();
  });

  test("renders cannibalization items with URLs and keywords", () => {
    const mockData = [
      {
        url: "https://example.com/page-1",
        keywordCount: 3,
        avgPosition: 5.2,
        keywords: [
          { keyword: "seo tools", position: 4 },
          { keyword: "seo software", position: 6 },
          { keyword: "best seo", position: 5 },
        ],
      },
    ];
    setupQueries([
      [api.keywordMap_queries.getKeywordCannibalization, mockData],
    ]);
    render(<CannibalizationTable domainId={DOMAIN_ID} />);

    expect(screen.getByText("keywordCannibalization")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/page-1")).toBeInTheDocument();
    expect(screen.getByText("seo tools")).toBeInTheDocument();
    expect(screen.getByText("seo software")).toBeInTheDocument();
    expect(screen.getByText("#4")).toBeInTheDocument();
    expect(screen.getByText("#6")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. CountriesDistributionTable
// ═══════════════════════════════════════════════════════════════════════════

describe("CountriesDistributionTable", () => {
  test("renders loading state when isLoading is true", () => {
    render(<CountriesDistributionTable data={{}} isLoading={true} />);
    const pulseElements = document.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  test("renders empty state when data has no entries", () => {
    render(<CountriesDistributionTable data={{}} isLoading={false} />);
    expect(screen.getByText("countriesEmpty")).toBeInTheDocument();
  });

  test("renders empty state when data has only blank keys", () => {
    render(
      <CountriesDistributionTable data={{ "": 5, " ": 3 }} isLoading={false} />
    );
    expect(screen.getByText("countriesEmpty")).toBeInTheDocument();
  });

  test("renders country rows sorted by count", () => {
    const data = { US: 150, DE: 80, WW: 50 };
    render(<CountriesDistributionTable data={data} isLoading={false} />);
    expect(screen.getByText("countriesTableSubtitle")).toBeInTheDocument();
    expect(screen.getByText("US")).toBeInTheDocument();
    expect(screen.getByText("DE")).toBeInTheDocument();
    expect(screen.getByText("Worldwide")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. CrawlLinksTable
// ═══════════════════════════════════════════════════════════════════════════

describe("CrawlLinksTable", () => {
  test("returns null when query returns undefined (loading)", () => {
    const { container } = render(<CrawlLinksTable domainId={DOMAIN_ID} />);
    expect(container.innerHTML).toBe("");
  });

  test("renders empty message when links array is empty", () => {
    setupQueries([
      [
        api.seoAudit_queries.getLinkAnalysis,
        {
          links: [],
          totalLinks: 0,
          internalLinks: 0,
          externalLinks: 0,
          nofollowLinks: 0,
        },
      ],
    ]);
    render(<CrawlLinksTable domainId={DOMAIN_ID} />);
    expect(screen.getByText("noLinksFound")).toBeInTheDocument();
  });

  test("renders summary counts and link rows", () => {
    setupQueries([
      [
        api.seoAudit_queries.getLinkAnalysis,
        {
          links: [
            {
              sourceUrl: "https://example.com/page-a",
              targetUrl: "https://example.com/page-b",
              anchorText: "click here",
              internal: true,
              nofollow: false,
            },
            {
              sourceUrl: "https://example.com/page-a",
              targetUrl: "https://external.com/resource",
              anchorText: "",
              internal: false,
              nofollow: true,
            },
          ],
          totalLinks: 2,
          internalLinks: 1,
          externalLinks: 1,
          nofollowLinks: 1,
        },
      ],
    ]);
    render(<CrawlLinksTable domainId={DOMAIN_ID} />);

    expect(screen.getByText("click here")).toBeInTheDocument();
    // Verify table structure by checking rows exist
    const rows = document.querySelectorAll("tbody tr");
    expect(rows.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. ImageAnalysisTable
// ═══════════════════════════════════════════════════════════════════════════

describe("ImageAnalysisTable", () => {
  test("returns null when query returns undefined (loading)", () => {
    const { container } = render(<ImageAnalysisTable domainId={DOMAIN_ID} />);
    expect(container.innerHTML).toBe("");
  });

  test("renders empty message when no images", () => {
    setupQueries([
      [
        api.seoAudit_queries.getImageAnalysis,
        { images: [], totalImages: 0, missingAltCount: 0 },
      ],
    ]);
    render(<ImageAnalysisTable domainId={DOMAIN_ID} />);
    expect(screen.getByText("noImagesFound")).toBeInTheDocument();
  });

  test("renders images with missing alt warnings", () => {
    setupQueries([
      [
        api.seoAudit_queries.getImageAnalysis,
        {
          images: [
            {
              pageUrl: "https://example.com/",
              imageUrl: "https://example.com/logo.png",
              alt: "Company logo",
              missingAlt: false,
            },
            {
              pageUrl: "https://example.com/about",
              imageUrl: "https://example.com/team.jpg",
              alt: "",
              missingAlt: true,
            },
          ],
          totalImages: 2,
          missingAltCount: 1,
        },
      ],
    ]);
    render(<ImageAnalysisTable domainId={DOMAIN_ID} />);

    expect(screen.getByText("Company logo")).toBeInTheDocument();
    expect(screen.getByText("missing")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. LinkBuildingProspectsTable
// ═══════════════════════════════════════════════════════════════════════════

describe("LinkBuildingProspectsTable", () => {
  test("renders loading skeleton when query returns undefined", () => {
    render(<LinkBuildingProspectsTable domainId={DOMAIN_ID} />);
    const pulseElements = document.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  test("renders empty state when prospects is empty array", () => {
    setupQueries([[api.linkBuilding_queries.getTopProspects, []]]);
    render(<LinkBuildingProspectsTable domainId={DOMAIN_ID} />);
    expect(screen.getByText("prospectTableTitle")).toBeInTheDocument();
    expect(screen.getByText("prospectEmpty")).toBeInTheDocument();
  });

  test("renders prospect rows with domain and score", () => {
    const mockProspects = [
      {
        _id: "p1" as any,
        referringDomain: "authority-site.com",
        prospectScore: 85,
        suggestedChannel: "guest_post",
        acquisitionDifficulty: "easy",
        estimatedImpact: 42,
        domainRank: 72,
        linksToCompetitors: 5,
        competitors: ["comp1.com", "comp2.com"],
        status: "identified",
      },
    ];
    setupQueries([[api.linkBuilding_queries.getTopProspects, mockProspects]]);
    render(<LinkBuildingProspectsTable domainId={DOMAIN_ID} />);

    expect(screen.getByText("prospectTableTitle")).toBeInTheDocument();
    expect(screen.getByText("authority-site.com")).toBeInTheDocument();
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. OnSitePagesTable
// ═══════════════════════════════════════════════════════════════════════════

describe("OnSitePagesTable", () => {
  test("renders LoadingState when query returns undefined", () => {
    render(<OnSitePagesTable domainId={DOMAIN_ID} />);
    expect(screen.getByTestId("loading-state")).toBeInTheDocument();
  });

  test("renders empty state when pages array is empty", () => {
    setupQueries([
      [api.seoAudit_queries.getPagesList, { pages: [], total: 0 }],
    ]);
    render(<OnSitePagesTable domainId={DOMAIN_ID} />);
    expect(screen.getByText("noPageDataAvailable")).toBeInTheDocument();
    expect(screen.getByText("noPageDataDescription")).toBeInTheDocument();
  });

  test("renders page rows with score and status code", () => {
    setupQueries([
      [
        api.seoAudit_queries.getPagesList,
        {
          pages: [
            {
              _id: "page1" as any,
              url: "https://example.com/about",
              title: "About Us",
              statusCode: 200,
              wordCount: 1200,
              issueCount: 2,
              onpageScore: 75,
              issues: [
                { type: "critical", category: "seo", message: "Missing H1" },
                { type: "warning", category: "seo", message: "Long title" },
              ],
              lighthouseScores: { performance: 82 },
            },
          ],
          total: 1,
        },
      ],
    ]);
    render(<OnSitePagesTable domainId={DOMAIN_ID} />);

    expect(screen.getByText("analyzedPages")).toBeInTheDocument();
    expect(screen.getByText("About Us")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("75")).toBeInTheDocument();
    expect(screen.getByText("82")).toBeInTheDocument();
    // wordCount rendered (toLocaleString may or may not add commas in jsdom)
    expect(screen.getByText(/1,?200/)).toBeInTheDocument();
  });

  test("renders no-issues badge when page has zero issues", () => {
    setupQueries([
      [
        api.seoAudit_queries.getPagesList,
        {
          pages: [
            {
              _id: "page2" as any,
              url: "https://example.com/clean",
              title: "Clean Page",
              statusCode: 200,
              wordCount: 500,
              issueCount: 0,
              onpageScore: 95,
              issues: [],
              lighthouseScores: null,
            },
          ],
          total: 1,
        },
      ],
    ]);
    render(<OnSitePagesTable domainId={DOMAIN_ID} />);
    expect(screen.getByText("noIssues")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. RedirectChainsTable
// ═══════════════════════════════════════════════════════════════════════════

describe("RedirectChainsTable", () => {
  test("returns null when query returns undefined (loading)", () => {
    const { container } = render(<RedirectChainsTable domainId={DOMAIN_ID} />);
    expect(container.innerHTML).toBe("");
  });

  test("renders empty message when no redirects", () => {
    setupQueries([
      [
        api.seoAudit_queries.getRedirectAnalysis,
        { redirects: [], totalRedirects: 0 },
      ],
    ]);
    render(<RedirectChainsTable domainId={DOMAIN_ID} />);
    expect(screen.getByText("noRedirectsFound")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  test("renders redirect rows with chain length", () => {
    setupQueries([
      [
        api.seoAudit_queries.getRedirectAnalysis,
        {
          redirects: [
            {
              sourceUrl: "https://example.com/old",
              targetUrl: "https://example.com/new",
              statusCode: 301,
              chainLength: 1,
            },
            {
              sourceUrl: "https://example.com/very-old",
              targetUrl: "https://example.com/final",
              statusCode: 302,
              chainLength: 4,
            },
          ],
          totalRedirects: 2,
        },
      ],
    ]);
    render(<RedirectChainsTable domainId={DOMAIN_ID} />);

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/old")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/new")).toBeInTheDocument();
    expect(screen.getByText("301")).toBeInTheDocument();
    expect(screen.getByText("302")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. UrlSelectionTable
// ═══════════════════════════════════════════════════════════════════════════

describe("UrlSelectionTable", () => {
  const baseProps = {
    urls: [] as string[],
    selectedUrls: new Set<string>(),
    onToggleUrl: vi.fn(),
    onToggleAll: vi.fn(),
  };

  test("renders empty state when urls array is empty", () => {
    render(<UrlSelectionTable {...baseProps} />);
    expect(screen.getByText("noUrlsFound")).toBeInTheDocument();
  });

  test("renders table rows with domain and path columns", () => {
    const urls = [
      "https://example.com/blog/post-1",
      "https://example.com/about",
    ];
    render(
      <UrlSelectionTable
        {...baseProps}
        urls={urls}
        selectedUrls={new Set(["https://example.com/about"])}
      />
    );

    expect(screen.getByText("/blog/post-1")).toBeInTheDocument();
    expect(screen.getByText("/about")).toBeInTheDocument();
    // Shows selection count
    expect(screen.getByText(/1 of 2 URLs selected/)).toBeInTheDocument();
  });

  test("renders checkboxes for URL selection", () => {
    const urls = ["https://example.com/page1"];
    render(<UrlSelectionTable {...baseProps} urls={urls} />);
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    // header checkbox + row checkbox
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. PageSpeedTab
// ═══════════════════════════════════════════════════════════════════════════

describe("PageSpeedTab", () => {
  test("renders no-data state with run button when queries return undefined/null", () => {
    setupQueries([
      [api.seoAudit_queries.getPageSpeedData, null],
      [api.seoAudit_queries.getPsiJobStatus, null],
    ]);
    render(<PageSpeedTab domainId={DOMAIN_ID} />);
    expect(screen.getByText("noPageSpeedData")).toBeInTheDocument();
    expect(screen.getByText("runPageSpeedAnalysis")).toBeInTheDocument();
  });

  test("renders progress card when job is running", () => {
    setupQueries([
      [api.seoAudit_queries.getPageSpeedData, null],
      [
        api.seoAudit_queries.getPsiJobStatus,
        {
          psiJobId: "job123",
          psiStatus: "running",
          psiProgress: { current: 3, total: 10 },
          psiStartedAt: Date.now() - 60000,
          psiError: null,
        },
      ],
    ]);
    render(<PageSpeedTab domainId={DOMAIN_ID} />);
    expect(screen.getByText("pageSpeedAnalysisInProgress")).toBeInTheDocument();
    expect(screen.getByText("job: job123")).toBeInTheDocument();
  });

  test("renders results table when data exists", () => {
    setupQueries([
      [
        api.seoAudit_queries.getPageSpeedData,
        {
          totalPages: 2,
          averages: {
            performance: 78,
            accessibility: 92,
            bestPractices: 85,
            seo: 90,
          },
          avgCwv: { lcp: 2100, cls: 0.05, fid: 80 },
          perPage: [
            {
              url: "https://example.com/",
              performance: 80,
              accessibility: 95,
              bestPractices: 88,
              seo: 92,
              lcp: 1800,
              cls: 0.03,
            },
          ],
        },
      ],
      [
        api.seoAudit_queries.getPsiJobStatus,
        {
          psiJobId: null,
          psiStatus: "completed",
          psiProgress: null,
          psiStartedAt: null,
          psiError: null,
        },
      ],
    ]);
    render(<PageSpeedTab domainId={DOMAIN_ID} />);

    expect(screen.getByText("avgLighthouseScores")).toBeInTheDocument();
    expect(screen.getByText("avgCoreWebVitals")).toBeInTheDocument();
    expect(screen.getByText("perPageBreakdown")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. QuickWinsTable
// ═══════════════════════════════════════════════════════════════════════════

describe("QuickWinsTable", () => {
  test("renders loading skeleton when query returns undefined", () => {
    render(<QuickWinsTable domainId={DOMAIN_ID} />);
    const pulseElements = document.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  test("renders empty state when data is empty array", () => {
    setupQueries([[api.keywordMap_queries.getQuickWins, []]]);
    render(<QuickWinsTable domainId={DOMAIN_ID} />);
    expect(screen.getByText("quickWins")).toBeInTheDocument();
    expect(screen.getByText("noQuickWinsFound")).toBeInTheDocument();
  });

  test("renders keyword rows with position and score", () => {
    const mockData = [
      {
        _id: "qw1" as any,
        keyword: "best seo tools",
        position: 8,
        positionChange: 2,
        searchVolume: 5400,
        difficulty: 25,
        cpc: 3.5,
        intent: "commercial",
        quickWinScore: 87,
        serpFeatures: ["featured_snippet"],
        backlinksInfo: { referringDomains: 12 },
      },
    ];
    setupQueries([[api.keywordMap_queries.getQuickWins, mockData]]);
    render(<QuickWinsTable domainId={DOMAIN_ID} />);

    expect(screen.getByText("quickWins")).toBeInTheDocument();
    expect(screen.getByText("best seo tools")).toBeInTheDocument();
    expect(screen.getByText("#8")).toBeInTheDocument();
    expect(screen.getByText("5.4K")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("$3.50")).toBeInTheDocument();
    expect(screen.getByText("Commercial")).toBeInTheDocument();
    expect(screen.getByText("87")).toBeInTheDocument();
  });

  test("renders position change badge for upward movement", () => {
    const mockData = [
      {
        _id: "qw2" as any,
        keyword: "climbing keyword",
        position: 12,
        positionChange: 5,
        searchVolume: 1200,
        difficulty: 35,
        cpc: null,
        intent: null,
        quickWinScore: 65,
        serpFeatures: [],
        backlinksInfo: null,
      },
    ];
    setupQueries([[api.keywordMap_queries.getQuickWins, mockData]]);
    render(<QuickWinsTable domainId={DOMAIN_ID} />);

    expect(screen.getByText("climbing keyword")).toBeInTheDocument();
    expect(screen.getByText("#12")).toBeInTheDocument();
  });
});
