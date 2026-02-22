/**
 * Smoke tests — verify that components can be imported and rendered
 * without crashing. Catches broken imports, missing exports, and
 * mount-time errors that would cause a white screen in production.
 *
 * Each test uses dynamic import so one broken component doesn't cascade.
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks for Convex, Next.js, and custom hooks
// ---------------------------------------------------------------------------

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn().mockResolvedValue(undefined)),
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

vi.mock("@/hooks/useEscapeClose", () => ({ useEscapeClose: vi.fn() }));
vi.mock("@/hooks/useDateRange", () => ({
  useDateRange: () => ({
    dateRange: { from: new Date("2025-01-01"), to: new Date("2025-01-31") },
    setDateRange: vi.fn(),
    comparisonRange: null,
    setComparisonRange: vi.fn(),
    preset: "30d",
    setPreset: vi.fn(),
  }),
}));

vi.mock("@/components/shared/LoadingState", () => ({
  LoadingState: () => <div data-testid="loading-state">Loading...</div>,
}));

vi.mock("@/components/common/DateRangePicker", () => ({
  DateRangePicker: () => <div data-testid="date-range-picker" />,
}));

vi.mock("motion/react", () => {
  const Component = ({ children, ...props }: Record<string, unknown>) => {
    const domSafe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      if (["className", "style", "id", "role", "onClick", "data-testid"].includes(k)) domSafe[k] = v;
    }
    return <div {...domSafe}>{children as React.ReactNode}</div>;
  };
  return {
    motion: new Proxy({}, {
      get: () => Component,
      has: () => true,
    }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useMotionValue: () => ({ get: () => 0, set: vi.fn() }),
    useTransform: () => ({ get: () => 0 }),
    useSpring: () => ({ get: () => 0 }),
    useInView: () => true,
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
  Background: () => <div />, Controls: () => <div />, MiniMap: () => <div />,
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
}));

// ---------------------------------------------------------------------------
// Helper — renders and validates HTML nesting rules
// ---------------------------------------------------------------------------

/** HTML elements that cannot contain interactive descendants */
const INTERACTIVE_TAGS = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"]);

/**
 * Recursively check for illegal nesting: interactive element inside interactive element.
 * Returns list of violations like "button > div > button".
 */
function findNestingViolations(el: Element, ancestor?: string): string[] {
  const violations: string[] = [];
  const tag = el.tagName;
  const isInteractive = INTERACTIVE_TAGS.has(tag) || el.getAttribute("role") === "button";

  if (isInteractive && ancestor) {
    violations.push(`<${ancestor.toLowerCase()}> contains <${tag.toLowerCase()}>`);
  }

  const activeAncestor = isInteractive ? tag : ancestor;
  for (const child of Array.from(el.children)) {
    violations.push(...findNestingViolations(child, activeAncestor));
  }
  return violations;
}

function smokeRender(element: React.ReactElement) {
  const { container } = render(element);
  expect(container).toBeTruthy();

  // Validate no illegal HTML nesting (button-in-button, a-in-a, etc.)
  const violations = findNestingViolations(container);
  if (violations.length > 0) {
    expect.fail(
      `HTML nesting violations:\n${violations.map((v) => `  - ${v}`).join("\n")}`
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  BASE COMPONENTS
// ═══════════════════════════════════════════════════════════════

describe("base/buttons", () => {
  it("Button", async () => {
    const { Button } = await import("@/components/base/buttons/button");
    smokeRender(<Button>Click</Button>);
  });
  it("CloseButton", async () => {
    const { CloseButton } = await import("@/components/base/buttons/close-button");
    smokeRender(<CloseButton onPress={vi.fn()} />);
  });
  it("ButtonUtility", async () => {
    const { ButtonUtility } = await import("@/components/base/buttons/button-utility");
    smokeRender(<ButtonUtility>Util</ButtonUtility>);
  });
});

describe("base/input", () => {
  it("Input", async () => {
    const { Input } = await import("@/components/base/input/input");
    smokeRender(<Input label="Email" placeholder="test@test.com" />);
  });
  it("HintText", async () => {
    const { HintText } = await import("@/components/base/input/hint-text");
    smokeRender(<HintText>Helper</HintText>);
  });
  it("Label", async () => {
    const { Label } = await import("@/components/base/input/label");
    smokeRender(<Label>Field</Label>);
  });
  it("InputGroup", async () => {
    const { InputGroup } = await import("@/components/base/input/input-group");
    smokeRender(<InputGroup><input /></InputGroup>);
  });
});

describe("base/textarea", () => {
  it("TextArea", async () => {
    const mod = await import("@/components/base/textarea/textarea");
    const TextArea = mod.TextArea || mod.default;
    smokeRender(<TextArea label="Notes" />);
  });
});

describe("base/checkbox", () => {
  it("Checkbox", async () => {
    const { Checkbox } = await import("@/components/base/checkbox/checkbox");
    smokeRender(<Checkbox>Accept</Checkbox>);
  });
  it("CheckboxBase", async () => {
    const { CheckboxBase } = await import("@/components/base/checkbox/checkbox");
    smokeRender(<CheckboxBase />);
  });
});

describe("base/toggle", () => {
  it("Toggle", async () => {
    const { Toggle } = await import("@/components/base/toggle/toggle");
    smokeRender(<Toggle />);
  });
});

describe("base/select", () => {
  it("Select", async () => {
    const { Select } = await import("@/components/base/select/select");
    smokeRender(<Select label="Country" items={[{ id: "us", label: "US" }]} />);
  });
  it("NativeSelect", async () => {
    const { NativeSelect } = await import("@/components/base/select/select-native");
    smokeRender(<NativeSelect label="Size" options={[{ label: "Small", value: "s" }, { label: "Med", value: "m" }]} />);
  });
  it("ComboBox", async () => {
    const { ComboBox } = await import("@/components/base/select/combobox");
    smokeRender(<ComboBox aria-label="search" />);
  });
});

describe("base/radio", () => {
  it("RadioButton + RadioGroup", async () => {
    const { RadioButton, RadioGroup } = await import("@/components/base/radio-buttons/radio-buttons");
    smokeRender(
      <RadioGroup aria-label="options">
        <RadioButton value="a">A</RadioButton>
        <RadioButton value="b">B</RadioButton>
      </RadioGroup>
    );
  });
});

describe("base/badges", () => {
  it("Badge", async () => {
    const { Badge } = await import("@/components/base/badges/badges");
    smokeRender(<Badge>New</Badge>);
  });
  it("BadgeWithDot", async () => {
    const { BadgeWithDot } = await import("@/components/base/badges/badges");
    smokeRender(<BadgeWithDot>Status</BadgeWithDot>);
  });
  it("BadgeWithIcon", async () => {
    const { BadgeWithIcon } = await import("@/components/base/badges/badges");
    smokeRender(<BadgeWithIcon>Alert</BadgeWithIcon>);
  });
  it("BadgeGroup", async () => {
    const { BadgeGroup } = await import("@/components/base/badges/badge-groups");
    smokeRender(<BadgeGroup>Group</BadgeGroup>);
  });
});

describe("base/avatar", () => {
  it("Avatar", async () => {
    const { Avatar } = await import("@/components/base/avatar/avatar");
    smokeRender(<Avatar />);
  });
  it("AvatarLabelGroup", async () => {
    const { AvatarLabelGroup } = await import("@/components/base/avatar/avatar-label-group");
    smokeRender(<AvatarLabelGroup size="md" title="John" subtitle="Admin" />);
  });
});

describe("base/modal", () => {
  it("Modal closed", async () => {
    const { Modal } = await import("@/components/base/modal/modal");
    smokeRender(<Modal isOpen={false} onClose={vi.fn()}><p>hidden</p></Modal>);
  });
  it("Modal open", async () => {
    const { Modal } = await import("@/components/base/modal/modal");
    const { container } = render(<Modal isOpen={true} onClose={vi.fn()} title="Test"><p>visible</p></Modal>);
    expect(container.textContent).toContain("visible");
  });
});

describe("base/tooltip", () => {
  it("Tooltip", async () => {
    const { Tooltip } = await import("@/components/base/tooltip/tooltip");
    smokeRender(<Tooltip title="Help"><button>hover</button></Tooltip>);
  });
});

describe("base/dropdown", () => {
  it("Dropdown", async () => {
    const { Dropdown } = await import("@/components/base/dropdown/dropdown");
    smokeRender(
      <Dropdown.Root>
        <Dropdown.DotsButton />
        <Dropdown.Popover>
          <Dropdown.Menu><Dropdown.Item label="Edit" /></Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    );
  });
});

describe("base/skeleton", () => {
  it("Skeleton", async () => {
    const { Skeleton } = await import("@/components/base/skeleton/skeleton");
    smokeRender(<Skeleton className="h-4 w-20" />);
  });
});

describe("base/progress", () => {
  it("ProgressBar", async () => {
    const { ProgressBar } = await import("@/components/base/progress-indicators/progress-indicators");
    smokeRender(<ProgressBar value={50} />);
  });
  it("CircleProgressBar", async () => {
    const { CircleProgressBar } = await import("@/components/base/progress-indicators/simple-circle");
    smokeRender(<CircleProgressBar value={60} />);
  });
});

describe("base/slider", () => {
  it("Slider", async () => {
    const { Slider } = await import("@/components/base/slider/slider");
    smokeRender(<Slider />);
  });
});

describe("base/button-group", () => {
  it("ButtonGroup", async () => {
    const { ButtonGroup, ButtonGroupItem } = await import("@/components/base/button-group/button-group");
    smokeRender(<ButtonGroup><ButtonGroupItem id="a">A</ButtonGroupItem></ButtonGroup>);
  });
});

describe("base/pin-input", () => {
  it("PinInput", async () => {
    const { PinInput } = await import("@/components/base/pin-input/pin-input");
    smokeRender(<PinInput length={4} />);
  });
});

// ═══════════════════════════════════════════════════════════════
//  ErrorBoundary
// ═══════════════════════════════════════════════════════════════

describe("ErrorBoundary", () => {
  it("renders children", async () => {
    const { ErrorBoundary } = await import("@/components/ErrorBoundary");
    const { container } = render(<ErrorBoundary><p>hello</p></ErrorBoundary>);
    expect(container.textContent).toContain("hello");
  });
});

// ═══════════════════════════════════════════════════════════════
//  PATTERN COMPONENTS
// ═══════════════════════════════════════════════════════════════

describe("patterns", () => {
  it("BulkActionBar", async () => {
    const { BulkActionBar } = await import("@/components/patterns/BulkActionBar");
    smokeRender(<BulkActionBar selectedCount={2} actions={[]} selectedIds={new Set(["a"])} onClearSelection={vi.fn()} />);
  });
  it("DataTableWithFilters", async () => {
    const { DataTableWithFilters } = await import("@/components/patterns/DataTableWithFilters");
    smokeRender(<DataTableWithFilters data={[]} columns={[{ id: "n", header: "Name", accessorKey: "n" as never }]} />);
  });
});

// ═══════════════════════════════════════════════════════════════
//  APPLICATION COMPONENTS
// ═══════════════════════════════════════════════════════════════

describe("application/alerts", () => {
  it("AlertFloating", async () => {
    const { AlertFloating } = await import("@/components/application/alerts/alerts");
    smokeRender(<AlertFloating title="Alert" description="Something happened" />);
  });
  it("AlertFullWidth", async () => {
    const { AlertFullWidth } = await import("@/components/application/alerts/alerts");
    smokeRender(<AlertFullWidth title="Alert" description="Something happened" />);
  });
});

describe("application/loading", () => {
  it("LoadingIndicator", async () => {
    const { LoadingIndicator } = await import("@/components/application/loading-indicator/loading-indicator");
    smokeRender(<LoadingIndicator />);
  });
});

describe("application/content-divider", () => {
  it("ContentDivider", async () => {
    const { ContentDivider } = await import("@/components/application/content-divider/content-divider");
    smokeRender(<ContentDivider />);
  });
});

describe("application/metrics", () => {
  it("MetricChangeIndicator", async () => {
    const { MetricChangeIndicator } = await import("@/components/application/metrics/metrics");
    smokeRender(<MetricChangeIndicator type="simple" trend="positive" value="12%" />);
  });
});

describe("application/section-headers", () => {
  it("SectionHeader compound", async () => {
    const { SectionHeader } = await import("@/components/application/section-headers/section-headers");
    smokeRender(
      <SectionHeader.Root>
        <SectionHeader.Heading>Title</SectionHeader.Heading>
      </SectionHeader.Root>
    );
  });
  it("SectionLabel", async () => {
    const { SectionLabel } = await import("@/components/application/section-headers/section-label");
    smokeRender(<SectionLabel.Root title="Label" />);
  });
});

describe("application/section-footer", () => {
  it("SectionFooter compound", async () => {
    const { SectionFooter } = await import("@/components/application/section-footers/section-footer");
    smokeRender(<SectionFooter.Root><SectionFooter.Actions>buttons</SectionFooter.Actions></SectionFooter.Root>);
  });
});

describe("application/table", () => {
  it("Table", async () => {
    const { Table } = await import("@/components/application/table/table");
    smokeRender(<Table aria-label="Test table"><thead><tr><th>Name</th></tr></thead></Table>);
  });
});

describe("application/code-snippet", () => {
  it("CodeSnippet", async () => {
    const { CodeSnippet } = await import("@/components/application/code-snippet/code-snippet");
    smokeRender(<CodeSnippet code="const x = 1;" language="javascript" />);
  });
});

// ═══════════════════════════════════════════════════════════════
//  FOUNDATION COMPONENTS
// ═══════════════════════════════════════════════════════════════

describe("foundations", () => {
  it("Dot", async () => {
    const { Dot } = await import("@/components/foundations/dot-icon");
    smokeRender(<Dot />);
  });
  it("FeaturedIcon", async () => {
    const { FeaturedIcon } = await import("@/components/foundations/featured-icon/featured-icon");
    smokeRender(<FeaturedIcon />);
  });
  it("AppLogo", async () => {
    const { AppLogo } = await import("@/components/foundations/logo/app-logo");
    smokeRender(<AppLogo />);
  });
  it("VisaIcon", async () => {
    const mod = await import("@/components/foundations/payment-icons/visa-icon");
    const VisaIcon = mod.default;
    smokeRender(<VisaIcon />);
  });
  it("MastercardIcon", async () => {
    const mod = await import("@/components/foundations/payment-icons/mastercard-icon");
    const MastercardIcon = mod.default;
    smokeRender(<MastercardIcon />);
  });
});

// ═══════════════════════════════════════════════════════════════
//  DOMAIN — BADGES
// ═══════════════════════════════════════════════════════════════

describe("domain/badges", () => {
  it("LiveBadge", async () => {
    const { LiveBadge } = await import("@/components/domain/badges/LiveBadge");
    smokeRender(<LiveBadge />);
  });
  it("PredictionBadge (loading)", async () => {
    const { PredictionBadge } = await import("@/components/domain/badges/PredictionBadge");
    smokeRender(<PredictionBadge keywordId={"test" as never} currentPosition={5} />);
  });
});

// ═══════════════════════════════════════════════════════════════
//  DOMAIN — CARDS
// ═══════════════════════════════════════════════════════════════

describe("domain/cards", () => {
  it("MetricCard", async () => {
    const { MetricCard } = await import("@/components/domain/cards/MetricCard");
    smokeRender(<MetricCard title="Keywords" value={42} />);
  });
  it("CoreWebVitalsCard", async () => {
    const { CoreWebVitalsCard } = await import("@/components/domain/cards/CoreWebVitalsCard");
    smokeRender(<CoreWebVitalsCard domainId={"test" as never} />);
  });
  it("LighthouseScoresCard", async () => {
    const { LighthouseScoresCard } = await import("@/components/domain/cards/LighthouseScoresCard");
    smokeRender(<LighthouseScoresCard domainId={"test" as never} />);
  });
  it("CrawlSummaryCards", async () => {
    const { CrawlSummaryCards } = await import("@/components/domain/cards/CrawlSummaryCards");
    smokeRender(<CrawlSummaryCards domainId={"test" as never} />);
  });
  it("ForecastSummaryCard", async () => {
    const { ForecastSummaryCard } = await import("@/components/domain/cards/ForecastSummaryCard");
    smokeRender(<ForecastSummaryCard domainId={"test" as never} />);
  });
  it("CompetitorGapComparisonCard", async () => {
    const { CompetitorGapComparisonCard } = await import("@/components/domain/cards/CompetitorGapComparisonCard");
    smokeRender(<CompetitorGapComparisonCard domainId={"test" as never} />);
  });
  it("RobotsTestResultsCard", async () => {
    const { RobotsTestResultsCard } = await import("@/components/domain/cards/RobotsTestResultsCard");
    smokeRender(<RobotsTestResultsCard domainId={"test" as never} />);
  });
  it("TopicClustersCard", async () => {
    const { TopicClustersCard } = await import("@/components/domain/cards/TopicClustersCard");
    smokeRender(<TopicClustersCard domainId={"test" as never} />);
  });
  it("LinkBuildingStatsCards", async () => {
    const { LinkBuildingStatsCards } = await import("@/components/domain/cards/LinkBuildingStatsCards");
    smokeRender(<LinkBuildingStatsCards domainId={"test" as never} />);
  });
});

// ═══════════════════════════════════════════════════════════════
//  DOMAIN — CHARTS (all useQuery → undefined → loading state)
// ═══════════════════════════════════════════════════════════════

describe("domain/charts", () => {
  it("MiniSparkline", async () => {
    const { MiniSparkline } = await import("@/components/domain/charts/MiniSparkline");
    smokeRender(<MiniSparkline data={[{ date: 1, position: 5 }, { date: 2, position: 3 }]} />);
  });
  it("PositionDistributionChart", async () => {
    const { PositionDistributionChart } = await import("@/components/domain/charts/PositionDistributionChart");
    smokeRender(<PositionDistributionChart domainId={"test" as never} />);
  });
  it("DifficultyDistributionChart", async () => {
    const { DifficultyDistributionChart } = await import("@/components/domain/charts/DifficultyDistributionChart");
    smokeRender(<DifficultyDistributionChart domainId={"test" as never} />);
  });
  it("IntentDistributionChart", async () => {
    const { IntentDistributionChart } = await import("@/components/domain/charts/IntentDistributionChart");
    smokeRender(<IntentDistributionChart domainId={"test" as never} />);
  });
  it("MovementTrendChart", async () => {
    const { MovementTrendChart } = await import("@/components/domain/charts/MovementTrendChart");
    smokeRender(<MovementTrendChart domainId={"test" as never} />);
  });
  it("PositionHistoryChart", async () => {
    const { PositionHistoryChart } = await import("@/components/domain/charts/PositionHistoryChart");
    smokeRender(<PositionHistoryChart domainId={"test" as never} />);
  });
  it("KeywordPositionChart", async () => {
    const { KeywordPositionChart } = await import("@/components/domain/charts/KeywordPositionChart");
    smokeRender(<KeywordPositionChart domainId={"test" as never} />);
  });
  it("GroupPerformanceChart", async () => {
    const { GroupPerformanceChart } = await import("@/components/domain/charts/GroupPerformanceChart");
    smokeRender(<GroupPerformanceChart domainId={"test" as never} />);
  });
  it("SERPFeaturesChart", async () => {
    const { SERPFeaturesChart } = await import("@/components/domain/charts/SERPFeaturesChart");
    smokeRender(<SERPFeaturesChart domainId={"test" as never} />);
  });
  it("MonthlySearchTrendChart", async () => {
    const { MonthlySearchTrendChart } = await import("@/components/domain/charts/MonthlySearchTrendChart");
    smokeRender(<MonthlySearchTrendChart data={[]} />);
  });
  it("ContentGapTrendsChart", async () => {
    const { ContentGapTrendsChart } = await import("@/components/domain/charts/ContentGapTrendsChart");
    smokeRender(<ContentGapTrendsChart domainId={"test" as never} />);
  });
  it("ContentGapBubbleChart", async () => {
    const { ContentGapBubbleChart } = await import("@/components/domain/charts/ContentGapBubbleChart");
    smokeRender(<ContentGapBubbleChart domainId={"test" as never} />);
  });
  it("BacklinksHistoryChart", async () => {
    const { BacklinksHistoryChart } = await import("@/components/domain/charts/BacklinksHistoryChart");
    smokeRender(<BacklinksHistoryChart domainId={"test" as never} />);
  });
  it("BacklinkVelocityChart", async () => {
    const { BacklinkVelocityChart } = await import("@/components/domain/charts/BacklinkVelocityChart");
    smokeRender(<BacklinkVelocityChart domainId={"test" as never} />);
  });
  it("AnchorTextDistributionChart", async () => {
    const { AnchorTextDistributionChart } = await import("@/components/domain/charts/AnchorTextDistributionChart");
    smokeRender(<AnchorTextDistributionChart domainId={"test" as never} />);
  });
  it("TLDDistributionChart", async () => {
    const { TLDDistributionChart } = await import("@/components/domain/charts/TLDDistributionChart");
    smokeRender(<TLDDistributionChart data={{ ".com": 50, ".org": 10 }} />);
  });
  it("CountriesDistributionChart", async () => {
    const { CountriesDistributionChart } = await import("@/components/domain/charts/CountriesDistributionChart");
    smokeRender(<CountriesDistributionChart data={{ US: 50, UK: 10 }} />);
  });
  it("LinkAttributesChart", async () => {
    const { LinkAttributesChart } = await import("@/components/domain/charts/LinkAttributesChart");
    smokeRender(<LinkAttributesChart domainId={"test" as never} />);
  });
  it("PlatformTypesChart", async () => {
    const { PlatformTypesChart } = await import("@/components/domain/charts/PlatformTypesChart");
    smokeRender(<PlatformTypesChart data={{ blog: 20, news: 5 }} />);
  });
  it("ReferringDomainQualityChart", async () => {
    const { ReferringDomainQualityChart } = await import("@/components/domain/charts/ReferringDomainQualityChart");
    smokeRender(<ReferringDomainQualityChart domainId={"test" as never} />);
  });
  it("BacklinkQualityComparisonChart", async () => {
    const { BacklinkQualityComparisonChart } = await import("@/components/domain/charts/BacklinkQualityComparisonChart");
    smokeRender(<BacklinkQualityComparisonChart domainId={"test" as never} />);
  });
  it("CompetitorOverviewChart", async () => {
    const { CompetitorOverviewChart } = await import("@/components/domain/charts/CompetitorOverviewChart");
    smokeRender(<CompetitorOverviewChart domainId={"test" as never} />);
  });
  it("CompetitorKeywordBarsChart", async () => {
    const { CompetitorKeywordBarsChart } = await import("@/components/domain/charts/CompetitorKeywordBarsChart");
    smokeRender(<CompetitorKeywordBarsChart domainId={"test" as never} />);
  });
  it("CompetitorBacklinkRadarChart", async () => {
    const { CompetitorBacklinkRadarChart } = await import("@/components/domain/charts/CompetitorBacklinkRadarChart");
    smokeRender(<CompetitorBacklinkRadarChart domainId={"test" as never} />);
  });
  it("CompetitorPositionScatterChart", async () => {
    const { CompetitorPositionScatterChart } = await import("@/components/domain/charts/CompetitorPositionScatterChart");
    smokeRender(<CompetitorPositionScatterChart domainId={"test" as never} />);
  });
  it("KeywordMapBubbleChart", async () => {
    const { KeywordMapBubbleChart } = await import("@/components/domain/charts/KeywordMapBubbleChart");
    smokeRender(<KeywordMapBubbleChart domainId={"test" as never} />);
  });
});

// ═══════════════════════════════════════════════════════════════
//  DOMAIN — TABLES (useQuery → undefined → loading/empty state)
// ═══════════════════════════════════════════════════════════════

describe("domain/tables", () => {
  it("AllKeywordsTable", async () => {
    const { AllKeywordsTable } = await import("@/components/domain/tables/AllKeywordsTable");
    smokeRender(<AllKeywordsTable domainId={"test" as never} />);
  });
  it("KeywordMonitoringTable", async () => {
    const { KeywordMonitoringTable } = await import("@/components/domain/tables/KeywordMonitoringTable");
    smokeRender(<KeywordMonitoringTable domainId={"test" as never} />);
  });
  it("CompetitorKeywordGapTable", async () => {
    const { CompetitorKeywordGapTable } = await import("@/components/domain/tables/CompetitorKeywordGapTable");
    smokeRender(<CompetitorKeywordGapTable domainId={"test" as never} />);
  });
  it("CompetitorOverlapTable", async () => {
    const { CompetitorOverlapTable } = await import("@/components/domain/tables/CompetitorOverlapTable");
    smokeRender(<CompetitorOverlapTable domainId={"test" as never} />);
  });
  it("ContentGapOpportunitiesTable", async () => {
    const { ContentGapOpportunitiesTable } = await import("@/components/domain/tables/ContentGapOpportunitiesTable");
    smokeRender(<ContentGapOpportunitiesTable domainId={"test" as never} />);
  });
  it("DiscoveredKeywordsTable", async () => {
    const { DiscoveredKeywordsTable } = await import("@/components/domain/tables/DiscoveredKeywordsTable");
    smokeRender(<DiscoveredKeywordsTable domainId={"test" as never} />);
  });
  it("QuickWinsTable", async () => {
    const { QuickWinsTable } = await import("@/components/domain/tables/QuickWinsTable");
    smokeRender(<QuickWinsTable domainId={"test" as never} />);
  });
  it("TopKeywordsTable", async () => {
    const { TopKeywordsTable } = await import("@/components/domain/tables/TopKeywordsTable");
    smokeRender(<TopKeywordsTable keywords={[]} title="Top Keywords" description="Test" />);
  });
  it("CannibalizationTable", async () => {
    const { CannibalizationTable } = await import("@/components/domain/tables/CannibalizationTable");
    smokeRender(<CannibalizationTable domainId={"test" as never} />);
  });
  it("OnSitePagesTable", async () => {
    const { OnSitePagesTable } = await import("@/components/domain/tables/OnSitePagesTable");
    smokeRender(<OnSitePagesTable domainId={"test" as never} />);
  });
  it("BacklinksTable", async () => {
    const { BacklinksTable } = await import("@/components/domain/tables/BacklinksTable");
    smokeRender(<BacklinksTable domainId={"test" as never} />);
  });
  it("BacklinkGapTable", async () => {
    const { BacklinkGapTable } = await import("@/components/domain/tables/BacklinkGapTable");
    smokeRender(<BacklinkGapTable domainId={"test" as never} />);
  });
  it("ReferringDomainsTable", async () => {
    const { ReferringDomainsTable } = await import("@/components/domain/tables/ReferringDomainsTable");
    smokeRender(<ReferringDomainsTable domainId={"test" as never} />);
  });
  it("AnchorTextTable", async () => {
    const { AnchorTextTable } = await import("@/components/domain/tables/AnchorTextTable");
    smokeRender(<AnchorTextTable domainId={"test" as never} />);
  });
  it("ToxicLinksTable", async () => {
    const { ToxicLinksTable } = await import("@/components/domain/tables/ToxicLinksTable");
    smokeRender(<ToxicLinksTable domainId={"test" as never} />);
  });
  it("TLDDistributionTable", async () => {
    const { TLDDistributionTable } = await import("@/components/domain/tables/TLDDistributionTable");
    smokeRender(<TLDDistributionTable data={{ ".com": 50 }} />);
  });
  it("CountriesDistributionTable", async () => {
    const { CountriesDistributionTable } = await import("@/components/domain/tables/CountriesDistributionTable");
    smokeRender(<CountriesDistributionTable data={{ US: 50 }} />);
  });
  it("LinkBuildingProspectsTable", async () => {
    const { LinkBuildingProspectsTable } = await import("@/components/domain/tables/LinkBuildingProspectsTable");
    smokeRender(<LinkBuildingProspectsTable domainId={"test" as never} />);
  });
  it("CrawlLinksTable", async () => {
    const { CrawlLinksTable } = await import("@/components/domain/tables/CrawlLinksTable");
    smokeRender(<CrawlLinksTable domainId={"test" as never} />);
  });
  it("RedirectChainsTable", async () => {
    const { RedirectChainsTable } = await import("@/components/domain/tables/RedirectChainsTable");
    smokeRender(<RedirectChainsTable domainId={"test" as never} />);
  });
  it("ImageAnalysisTable", async () => {
    const { ImageAnalysisTable } = await import("@/components/domain/tables/ImageAnalysisTable");
    smokeRender(<ImageAnalysisTable domainId={"test" as never} />);
  });
  it("PageSpeedTab", async () => {
    const { PageSpeedTab } = await import("@/components/domain/tables/PageSpeedTab");
    smokeRender(<PageSpeedTab domainId={"test" as never} />);
  });
});

// ═══════════════════════════════════════════════════════════════
//  DOMAIN — MODALS (all closed — no DOM output, just import check)
// ═══════════════════════════════════════════════════════════════

describe("domain/modals", () => {
  it("AddKeywordsModal", async () => {
    const { AddKeywordsModal } = await import("@/components/domain/modals/AddKeywordsModal");
    smokeRender(<AddKeywordsModal isOpen={false} onClose={vi.fn()} domainId={"test" as never} />);
  });
  it("AddCompetitorModal", async () => {
    const { AddCompetitorModal } = await import("@/components/domain/modals/AddCompetitorModal");
    smokeRender(<AddCompetitorModal isOpen={false} onClose={vi.fn()} domainId={"test" as never} />);
  });
  it("GroupManagementModal", async () => {
    const { GroupManagementModal } = await import("@/components/domain/modals/GroupManagementModal");
    smokeRender(<GroupManagementModal isOpen={false} onClose={vi.fn()} domainId={"test" as never} />);
  });
  it("RefreshConfirmModal", async () => {
    const { RefreshConfirmModal } = await import("@/components/domain/modals/RefreshConfirmModal");
    smokeRender(<RefreshConfirmModal isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} />);
  });
  it("GenerateReportModal", async () => {
    const { GenerateReportModal } = await import("@/components/domain/modals/GenerateReportModal");
    smokeRender(<GenerateReportModal isOpen={false} onClose={vi.fn()} domainId={"test" as never} />);
  });
  it("ShareLinkDialog", async () => {
    const { ShareLinkDialog } = await import("@/components/domain/modals/ShareLinkDialog");
    smokeRender(<ShareLinkDialog isOpen={false} onClose={vi.fn()} url="https://example.com" />);
  });
  it("CreateCompetitorReportModal", async () => {
    const { CreateCompetitorReportModal } = await import("@/components/domain/modals/CreateCompetitorReportModal");
    smokeRender(<CreateCompetitorReportModal isOpen={false} onClose={vi.fn()} domainId={"test" as never} />);
  });
});

// ═══════════════════════════════════════════════════════════════
//  DOMAIN — SECTIONS (useQuery → undefined → loading state)
// ═══════════════════════════════════════════════════════════════

describe("domain/sections", () => {
  it("MonitoringStats", async () => {
    const { MonitoringStats } = await import("@/components/domain/sections/MonitoringStats");
    smokeRender(<MonitoringStats domainId={"test" as never} />);
  });
  it("ExecutiveSummary", async () => {
    const { ExecutiveSummary } = await import("@/components/domain/sections/ExecutiveSummary");
    smokeRender(<ExecutiveSummary domainId={"test" as never} />);
  });
  it("InsightsSection", async () => {
    const { InsightsSection } = await import("@/components/domain/sections/InsightsSection");
    smokeRender(<InsightsSection domainId={"test" as never} />);
  });
  it("ContentGapSection", async () => {
    const { ContentGapSection } = await import("@/components/domain/sections/ContentGapSection");
    smokeRender(<ContentGapSection domainId={"test" as never} />);
  });
  it("CompetitorManagementSection", async () => {
    const { CompetitorManagementSection } = await import("@/components/domain/sections/CompetitorManagementSection");
    smokeRender(<CompetitorManagementSection domainId={"test" as never} />);
  });
  it("BacklinkProfileSection", async () => {
    const { BacklinkProfileSection } = await import("@/components/domain/sections/BacklinkProfileSection");
    smokeRender(<BacklinkProfileSection domainId={"test" as never} />);
  });
  it("BacklinksSummaryStats", async () => {
    const { BacklinksSummaryStats } = await import("@/components/domain/sections/BacklinksSummaryStats");
    smokeRender(<BacklinksSummaryStats domainId={"test" as never} />);
  });
  it("OnSiteSection", async () => {
    const { OnSiteSection } = await import("@/components/domain/sections/OnSiteSection");
    smokeRender(<OnSiteSection domainId={"test" as never} />);
  });
  it("CrawlAnalyticsSection", async () => {
    const { CrawlAnalyticsSection } = await import("@/components/domain/sections/CrawlAnalyticsSection");
    smokeRender(<CrawlAnalyticsSection domainId={"test" as never} />);
  });
  it("SERPFeaturesSection", async () => {
    const { SERPFeaturesSection } = await import("@/components/domain/sections/SERPFeaturesSection");
    smokeRender(<SERPFeaturesSection domainId={"test" as never} />);
  });
  it("LinkBuildingSection", async () => {
    const { LinkBuildingSection } = await import("@/components/domain/sections/LinkBuildingSection");
    smokeRender(<LinkBuildingSection domainId={"test" as never} />);
  });
  it("KeywordMapSection", async () => {
    const { KeywordMapSection } = await import("@/components/domain/sections/KeywordMapSection");
    smokeRender(<KeywordMapSection domainId={"test" as never} />);
  });
  it("CompetitorBacklinksSection", async () => {
    const { CompetitorBacklinksSection } = await import("@/components/domain/sections/CompetitorBacklinksSection");
    smokeRender(<CompetitorBacklinksSection domainId={"test" as never} />);
  });
  it("CompetitorContentAnalysisSection", async () => {
    const { CompetitorContentAnalysisSection } = await import("@/components/domain/sections/CompetitorContentAnalysisSection");
    smokeRender(<CompetitorContentAnalysisSection domainId={"test" as never} />);
  });
  it("CompetitorAnalysisReportsSection", async () => {
    const { CompetitorAnalysisReportsSection } = await import("@/components/domain/sections/CompetitorAnalysisReportsSection");
    smokeRender(<CompetitorAnalysisReportsSection domainId={"test" as never} />);
  });
  it("AIKeywordResearchSection", async () => {
    const { AIKeywordResearchSection } = await import("@/components/domain/sections/AIKeywordResearchSection");
    smokeRender(<AIKeywordResearchSection domainId={"test" as never} />);
  });
  it("AIStrategySection", async () => {
    const { AIStrategySection } = await import("@/components/domain/sections/AIStrategySection");
    smokeRender(<AIStrategySection domainId={"test" as never} />);
  });
  it("StrategySection", async () => {
    const { StrategySection } = await import("@/components/domain/sections/StrategySection");
    smokeRender(<StrategySection domainId={"test" as never} />);
  });
  it("DiagnosticSection", async () => {
    const { DiagnosticSection } = await import("@/components/domain/sections/DiagnosticSection");
    smokeRender(<DiagnosticSection domainId={"test" as never} />);
  });
  it("WordFrequencySection", async () => {
    const { WordFrequencySection } = await import("@/components/domain/sections/WordFrequencySection");
    smokeRender(<WordFrequencySection domainId={"test" as never} />);
  });
  it("GeneratorsSection", async () => {
    const { GeneratorsSection } = await import("@/components/domain/sections/GeneratorsSection");
    smokeRender(<GeneratorsSection domainId={"test" as never} />);
  });
  it("RobotsAnalysisCard", async () => {
    const { RobotsAnalysisCard } = await import("@/components/domain/sections/RobotsAnalysisCard");
    smokeRender(<RobotsAnalysisCard domainId={"test" as never} />);
  });
  it("SitemapOverviewCard", async () => {
    const { SitemapOverviewCard } = await import("@/components/domain/sections/SitemapOverviewCard");
    smokeRender(<SitemapOverviewCard domainId={"test" as never} />);
  });
  it("InstantPagesMetrics", async () => {
    const { InstantPagesMetrics } = await import("@/components/domain/sections/InstantPagesMetrics");
    smokeRender(<InstantPagesMetrics domainId={"test" as never} />);
  });
});

// ═══════════════════════════════════════════════════════════════
//  DOMAIN — JOB STATUS
// ═══════════════════════════════════════════════════════════════

describe("domain/job-status", () => {
  it("GlobalJobStatus", async () => {
    const { GlobalJobStatus } = await import("@/components/domain/job-status/GlobalJobStatus");
    smokeRender(<GlobalJobStatus />);
  });
});
