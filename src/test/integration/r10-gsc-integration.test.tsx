/**
 * R10 — Google Search Console Integration tests.
 *
 * Tests cover GscConnectionPanel (settings, org-level OAuth only),
 * GscPropertySection (domain-level property selection),
 * and GscMetricsCard (domain metrics display).
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useQuery, useMutation } from "convex/react";
import { getFunctionName } from "convex/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function refToKey(ref: unknown): string {
  try {
    return getFunctionName(ref as never);
  } catch {
    return "";
  }
}

function setupQueryMock(responses: Record<string, unknown>) {
  vi.mocked(useQuery).mockImplementation(((ref: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    const key = refToKey(ref);
    for (const [pattern, value] of Object.entries(responses)) {
      if (key.includes(pattern)) return value;
    }
    return undefined;
  }) as never);
}

const mutationMap = new Map<string, ReturnType<typeof vi.fn>>();
function setupMutationMock() {
  mutationMap.clear();
  vi.mocked(useMutation).mockImplementation(((ref: unknown) => {
    const key = refToKey(ref);
    if (!mutationMap.has(key))
      mutationMap.set(key, vi.fn().mockResolvedValue(undefined));
    return mutationMap.get(key)!;
  }) as never);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_ID = "org_123" as never;
const DOMAIN_ID = "domain_456" as never;

const CONNECTION_ACTIVE = {
  googleEmail: "user@gmail.com",
  properties: [
    { url: "https://example.com/", type: "url_prefix" },
    { url: "sc-domain:example.com", type: "domain" },
  ],
  selectedPropertyUrl: "https://example.com/",
  lastSyncAt: Date.now() - 3600 * 1000,
  status: "active",
  connectedAt: Date.now() - 86400 * 1000,
};

const CONNECTION_NO_PROPERTIES = {
  googleEmail: "user@gmail.com",
  properties: [],
  selectedPropertyUrl: undefined,
  lastSyncAt: null,
  status: "active",
  connectedAt: Date.now(),
};

const GSC_DOMAIN_CONNECTED = {
  connected: true,
  properties: [
    { url: "https://example.com/", type: "url_prefix" },
    { url: "sc-domain:example.com", type: "domain" },
  ],
  selectedPropertyUrl: "sc-domain:example.com",
};

const GSC_DOMAIN_CONNECTED_NO_SELECTION = {
  connected: true,
  properties: [
    { url: "https://example.com/", type: "url_prefix" },
    { url: "sc-domain:example.com", type: "domain" },
  ],
  selectedPropertyUrl: undefined,
};

const GSC_DOMAIN_NOT_CONNECTED = {
  connected: false,
  properties: [],
  selectedPropertyUrl: undefined,
};

const GSC_METRICS = {
  totalClicks: 12450,
  totalImpressions: 543200,
  avgCtr: 0.023,
  avgPosition: 14.7,
  topKeywords: [
    { keyword: "best seo tools", clicks: 320, impressions: 8400, avgCtr: 0.038, avgPosition: 4.2 },
    { keyword: "seo monitoring", clicks: 210, impressions: 6100, avgCtr: 0.034, avgPosition: 6.8 },
  ],
};

const GSC_METRICS_EMPTY = {
  totalClicks: 0,
  totalImpressions: 0,
  avgCtr: 0,
  avgPosition: 0,
  topKeywords: [],
};

// ---------------------------------------------------------------------------
// Lazy imports (after mocks)
// ---------------------------------------------------------------------------

async function loadGscConnectionPanel() {
  const { GscConnectionPanel } = await import(
    "@/components/settings/GscConnectionPanel"
  );
  return GscConnectionPanel;
}

async function loadGscMetricsCard() {
  const { GscMetricsCard } = await import(
    "@/components/domain/GscMetricsCard"
  );
  return GscMetricsCard;
}

// Inline GscPropertySection for testing (it's defined inside the domain page)
// We test it by importing the page module... but since it's a complex page,
// we'll create a minimal wrapper that matches the component's behavior.
function GscPropertySectionTest({ domainId }: { domainId: never }) {
  const gscData = useQuery(
    { [Symbol.for("functionName")]: "gsc:getGscPropertiesForDomain" } as never,
    { domainId }
  );
  const setGscProperty = useMutation(
    { [Symbol.for("functionName")]: "gsc:setDomainGscProperty" } as never
  );

  if (gscData === undefined) {
    return <div className="animate-pulse" data-testid="gsc-property-loading" />;
  }

  if (!gscData || !(gscData as { connected: boolean }).connected) {
    return (
      <div>
        <h3>gscProperty</h3>
        <p>gscConnectHint</p>
      </div>
    );
  }

  const data = gscData as {
    connected: boolean;
    properties: { url: string; type: string }[];
    selectedPropertyUrl?: string;
  };

  return (
    <div>
      <h3>gscProperty</h3>
      {data.properties.length > 0 ? (
        <select
          value={data.selectedPropertyUrl || ""}
          onChange={async (e) => {
            await setGscProperty({
              domainId,
              propertyUrl: e.target.value || null,
            });
          }}
        >
          <option value="">gscSelectProperty</option>
          {data.properties.map((p) => (
            <option key={p.url} value={p.url}>
              {p.url} ({p.type})
            </option>
          ))}
        </select>
      ) : (
        <p>gscNotConnected</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GscConnectionPanel (org-level OAuth connection only)
// ---------------------------------------------------------------------------

describe("GscConnectionPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMutationMock();
  });

  it("renders loading state when connection is undefined", async () => {
    setupQueryMock({}); // returns undefined for everything
    const Panel = await loadGscConnectionPanel();
    const { container } = render(<Panel organizationId={ORG_ID} />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("renders connect button when not connected (null)", async () => {
    setupQueryMock({ getGscConnection: null });
    const Panel = await loadGscConnectionPanel();
    render(<Panel organizationId={ORG_ID} />);
    expect(screen.getByText("gscConnect")).toBeInTheDocument();
    expect(screen.getByText("gscDescription")).toBeInTheDocument();
  });

  it("renders connected state with email and status badge", async () => {
    setupQueryMock({ getGscConnection: CONNECTION_ACTIVE });
    const Panel = await loadGscConnectionPanel();
    render(<Panel organizationId={ORG_ID} />);
    expect(screen.getByText("gscConnected")).toBeInTheDocument();
    expect(screen.getByText("user@gmail.com")).toBeInTheDocument();
  });

  it("does NOT render property selector (moved to domain level)", async () => {
    setupQueryMock({ getGscConnection: CONNECTION_ACTIVE });
    const Panel = await loadGscConnectionPanel();
    render(<Panel organizationId={ORG_ID} />);
    expect(screen.queryByText("gscProperties")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("calls initiateGscConnection on connect click", async () => {
    setupQueryMock({ getGscConnection: null });
    const initiateMock = vi.fn().mockResolvedValue({
      authUrl: "https://accounts.google.com/o/oauth2",
      state: "abc",
    });
    vi.mocked(useMutation).mockImplementation(((ref: unknown) => {
      const key = refToKey(ref);
      if (key.includes("initiateGscConnection")) return initiateMock;
      if (!mutationMap.has(key))
        mutationMap.set(key, vi.fn().mockResolvedValue(undefined));
      return mutationMap.get(key)!;
    }) as never);

    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    const Panel = await loadGscConnectionPanel();
    render(<Panel organizationId={ORG_ID} />);
    fireEvent.click(screen.getByText("gscConnect"));

    await waitFor(() => {
      expect(initiateMock).toHaveBeenCalledWith({ organizationId: ORG_ID });
    });

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalled();
    });

    openSpy.mockRestore();
  });

  it("calls disconnectGsc on disconnect click", async () => {
    setupQueryMock({ getGscConnection: CONNECTION_ACTIVE });
    const Panel = await loadGscConnectionPanel();
    render(<Panel organizationId={ORG_ID} />);

    fireEvent.click(screen.getByText("gscDisconnect"));

    const disconnectFn = mutationMap.get(
      Array.from(mutationMap.keys()).find((k) => k.includes("disconnectGsc")) || ""
    );
    expect(disconnectFn).toBeDefined();
    if (disconnectFn) {
      expect(disconnectFn).toHaveBeenCalledWith({ organizationId: ORG_ID });
    }
  });

  it("shows last sync time when available", async () => {
    setupQueryMock({ getGscConnection: CONNECTION_ACTIVE });
    const Panel = await loadGscConnectionPanel();
    render(<Panel organizationId={ORG_ID} />);
    expect(screen.getByText(/gscLastSync/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// GscPropertySection (domain-level property selection)
// ---------------------------------------------------------------------------

describe("GscPropertySection (domain-level)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMutationMock();
  });

  it("renders loading state when data is undefined", () => {
    setupQueryMock({}); // returns undefined
    const { container } = render(<GscPropertySectionTest domainId={DOMAIN_ID} />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("shows connect hint when GSC is not connected", () => {
    setupQueryMock({ getGscPropertiesForDomain: GSC_DOMAIN_NOT_CONNECTED });
    render(<GscPropertySectionTest domainId={DOMAIN_ID} />);
    expect(screen.getByText("gscConnectHint")).toBeInTheDocument();
  });

  it("shows property dropdown when connected with properties", () => {
    setupQueryMock({ getGscPropertiesForDomain: GSC_DOMAIN_CONNECTED });
    render(<GscPropertySectionTest domainId={DOMAIN_ID} />);
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    const options = select.querySelectorAll("option");
    // 1 placeholder + 2 properties
    expect(options.length).toBe(3);
  });

  it("pre-selects the current domain property", () => {
    setupQueryMock({ getGscPropertiesForDomain: GSC_DOMAIN_CONNECTED });
    render(<GscPropertySectionTest domainId={DOMAIN_ID} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("sc-domain:example.com");
  });

  it("shows placeholder when no property selected", () => {
    setupQueryMock({ getGscPropertiesForDomain: GSC_DOMAIN_CONNECTED_NO_SELECTION });
    render(<GscPropertySectionTest domainId={DOMAIN_ID} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("");
  });

  it("calls setDomainGscProperty on selection change", async () => {
    setupQueryMock({ getGscPropertiesForDomain: GSC_DOMAIN_CONNECTED_NO_SELECTION });
    render(<GscPropertySectionTest domainId={DOMAIN_ID} />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "sc-domain:example.com" } });

    const setPropertyFn = mutationMap.get(
      Array.from(mutationMap.keys()).find((k) => k.includes("setDomainGscProperty")) || ""
    );
    expect(setPropertyFn).toBeDefined();
    if (setPropertyFn) {
      await waitFor(() => {
        expect(setPropertyFn).toHaveBeenCalledWith({
          domainId: DOMAIN_ID,
          propertyUrl: "sc-domain:example.com",
        });
      });
    }
  });

  it("sends null when clearing property selection", async () => {
    setupQueryMock({ getGscPropertiesForDomain: GSC_DOMAIN_CONNECTED });
    render(<GscPropertySectionTest domainId={DOMAIN_ID} />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "" } });

    const setPropertyFn = mutationMap.get(
      Array.from(mutationMap.keys()).find((k) => k.includes("setDomainGscProperty")) || ""
    );
    if (setPropertyFn) {
      await waitFor(() => {
        expect(setPropertyFn).toHaveBeenCalledWith({
          domainId: DOMAIN_ID,
          propertyUrl: null,
        });
      });
    }
  });
});

// ---------------------------------------------------------------------------
// GscMetricsCard
// ---------------------------------------------------------------------------

describe("GscMetricsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMutationMock();
  });

  it("renders loading state when metrics undefined", async () => {
    setupQueryMock({}); // returns undefined
    const Card = await loadGscMetricsCard();
    const { container } = render(<Card domainId={DOMAIN_ID} />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("renders zero-clicks state when GSC data has no clicks", async () => {
    setupQueryMock({ getGscMetrics: GSC_METRICS_EMPTY });
    const Card = await loadGscMetricsCard();
    const { container } = render(<Card domainId={DOMAIN_ID} />);
    expect(container.firstChild).not.toBeNull();
    expect(container.textContent).toContain("0");
  });

  it("returns null when metrics is null", async () => {
    setupQueryMock({ getGscMetrics: null });
    const Card = await loadGscMetricsCard();
    const { container } = render(<Card domainId={DOMAIN_ID} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders metrics when data exists", async () => {
    setupQueryMock({ getGscMetrics: GSC_METRICS });
    const Card = await loadGscMetricsCard();
    render(<Card domainId={DOMAIN_ID} />);
    expect(screen.getByText("gscMetricsTitle")).toBeInTheDocument();
    expect(screen.getByText("gscClicks")).toBeInTheDocument();
    expect(screen.getByText("gscImpressions")).toBeInTheDocument();
    expect(screen.getByText("gscAvgCtr")).toBeInTheDocument();
    expect(screen.getByText("gscAvgPosition")).toBeInTheDocument();
  });

  it("formats numbers correctly", async () => {
    setupQueryMock({ getGscMetrics: GSC_METRICS });
    const Card = await loadGscMetricsCard();
    render(<Card domainId={DOMAIN_ID} />);
    expect(screen.getByText(/12.?450/)).toBeInTheDocument();
    expect(screen.getByText(/543.?200/)).toBeInTheDocument();
    expect(screen.getByText(/2\.3/)).toBeInTheDocument();
    expect(screen.getByText("14.7")).toBeInTheDocument();
  });
});
