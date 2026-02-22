/**
 * Integration tests for R27: Webhooks & Integrations
 *
 * Tests WebhooksTab and IntegrationsPanel components with mocked
 * Convex queries/mutations following project test patterns.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
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
  usePathname: () => "/settings",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    permissions: ["domains.create", "domains.edit"],
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

vi.mock("@/components/shared/LoadingState", () => ({
  LoadingState: (props: Record<string, unknown>) => (
    <div data-testid="loading-state" data-type={props.type}>Loading...</div>
  ),
}));

vi.mock("@/components/ui/glowing-effect", () => ({ GlowingEffect: () => null }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: vi.fn() }) }));

// Override global next-intl mock to use real translations
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
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useQuery, useMutation, useAction } from "convex/react";
import { renderWithProviders } from "@/test/helpers/render-with-providers";
import WebhooksTab from "@/components/settings/WebhooksTab";
import IntegrationsPanel from "@/components/settings/IntegrationsPanel";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_ID = "org_123" as any;

const WEBHOOK_ENDPOINTS = [
  {
    _id: "wh_1" as any,
    _creationTime: Date.now(),
    orgId: ORG_ID,
    url: "https://example.com/hook1",
    secret: "secret_abc",
    events: ["position.changed", "alert.triggered"],
    status: "active" as const,
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    lastTriggeredAt: Date.now() - 60 * 60 * 1000,
    failureCount: 0,
  },
  {
    _id: "wh_2" as any,
    _creationTime: Date.now(),
    orgId: ORG_ID,
    url: "https://example.com/hook2",
    secret: "secret_def",
    events: ["keyword.added"],
    status: "paused" as const,
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    failureCount: 0,
  },
  {
    _id: "wh_3" as any,
    _creationTime: Date.now(),
    orgId: ORG_ID,
    url: "https://example.com/hook3",
    secret: "secret_ghi",
    events: ["backlink.lost"],
    status: "failed" as const,
    createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    failureCount: 3,
  },
];

const WEBHOOK_DELIVERIES = [
  {
    _id: "del_1" as any,
    _creationTime: Date.now(),
    webhookEndpointId: "wh_1" as any,
    event: "position.changed",
    payload: '{"keyword":"seo tools"}',
    statusCode: 200,
    response: "OK",
    attemptNumber: 1,
    createdAt: Date.now() - 30 * 60 * 1000,
    deliveredAt: Date.now() - 30 * 60 * 1000,
  },
  {
    _id: "del_2" as any,
    _creationTime: Date.now(),
    webhookEndpointId: "wh_1" as any,
    event: "alert.triggered",
    payload: '{"alert":"ranking drop"}',
    statusCode: 500,
    response: "Internal Server Error",
    attemptNumber: 1,
    createdAt: Date.now() - 15 * 60 * 1000,
  },
];

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

const mutationMap = new Map<string, ReturnType<typeof vi.fn>>();

function setupMutations() {
  mutationMap.clear();
  vi.mocked(useMutation).mockImplementation(((ref: unknown) => {
    const key = getFunctionName(ref as any);
    if (!mutationMap.has(key)) {
      mutationMap.set(key, vi.fn().mockResolvedValue(undefined));
    }
    return mutationMap.get(key)!;
  }) as any);
}

let actionFn: ReturnType<typeof vi.fn>;

function setupActions() {
  actionFn = vi.fn().mockResolvedValue(undefined);
  vi.mocked(useAction).mockReturnValue(actionFn as any);
}

// ---------------------------------------------------------------------------
// Tests: WebhooksTab
// ---------------------------------------------------------------------------

describe("WebhooksTab", () => {
  beforeEach(() => {
    setupMutations();
    setupActions();
  });

  it("shows loading state when queries return undefined", () => {
    setupQueries({});
    renderWithProviders(<WebhooksTab orgId={ORG_ID} />);
    expect(screen.getByTestId("webhooks-loading")).toBeInTheDocument();
  });

  it("shows empty state when no webhooks exist", () => {
    setupQueries({ "webhooks:getWebhookEndpoints": [] });
    renderWithProviders(<WebhooksTab orgId={ORG_ID} />);
    expect(screen.getByTestId("no-webhooks")).toBeInTheDocument();
    expect(screen.getByText(/No webhooks configured/)).toBeInTheDocument();
  });

  it("renders webhook list with status badges", () => {
    setupQueries({ "webhooks:getWebhookEndpoints": WEBHOOK_ENDPOINTS });
    renderWithProviders(<WebhooksTab orgId={ORG_ID} />);

    const endpoints = screen.getAllByTestId("webhook-endpoint");
    expect(endpoints).toHaveLength(3);

    // Verify URLs are displayed
    expect(screen.getByText("https://example.com/hook1")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/hook2")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/hook3")).toBeInTheDocument();

    // Verify status badges exist
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("renders event tags for each webhook", () => {
    setupQueries({ "webhooks:getWebhookEndpoints": WEBHOOK_ENDPOINTS });
    renderWithProviders(<WebhooksTab orgId={ORG_ID} />);

    // Event tags from first webhook
    expect(screen.getByText("position.changed")).toBeInTheDocument();
    expect(screen.getByText("alert.triggered")).toBeInTheDocument();
    expect(screen.getByText("keyword.added")).toBeInTheDocument();
    expect(screen.getByText("backlink.lost")).toBeInTheDocument();
  });

  it("opens add webhook modal when button is clicked", async () => {
    setupQueries({ "webhooks:getWebhookEndpoints": [] });
    renderWithProviders(<WebhooksTab orgId={ORG_ID} />);

    const addBtn = screen.getByTestId("add-webhook-btn");
    await userEvent.click(addBtn);

    expect(screen.getByTestId("webhook-modal")).toBeInTheDocument();
    expect(screen.getByTestId("webhook-url-input")).toBeInTheDocument();
    expect(screen.getByTestId("webhook-secret-input")).toBeInTheDocument();
  });

  it("validates URL is required in add modal", async () => {
    setupQueries({ "webhooks:getWebhookEndpoints": [] });
    renderWithProviders(<WebhooksTab orgId={ORG_ID} />);

    await userEvent.click(screen.getByTestId("add-webhook-btn"));
    await userEvent.click(screen.getByTestId("webhook-save-btn"));

    // createWebhook should NOT have been called (URL is empty)
    const createMut = mutationMap.get("webhooks:createWebhook");
    expect(createMut).not.toHaveBeenCalled();
  });

  it("calls createWebhook mutation with correct args", async () => {
    setupQueries({ "webhooks:getWebhookEndpoints": [] });
    renderWithProviders(<WebhooksTab orgId={ORG_ID} />);

    await userEvent.click(screen.getByTestId("add-webhook-btn"));

    const urlInput = screen.getByTestId("webhook-url-input");
    await userEvent.type(urlInput, "https://new-hook.com/endpoint");

    const secretInput = screen.getByTestId("webhook-secret-input");
    await userEvent.type(secretInput, "my-secret-key");

    await userEvent.click(screen.getByTestId("webhook-save-btn"));

    const createMut = mutationMap.get("webhooks:createWebhook");
    expect(createMut).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: ORG_ID,
        url: "https://new-hook.com/endpoint",
        secret: "my-secret-key",
      })
    );
  });

  it("opens edit modal with pre-filled data", async () => {
    setupQueries({ "webhooks:getWebhookEndpoints": WEBHOOK_ENDPOINTS });
    renderWithProviders(<WebhooksTab orgId={ORG_ID} />);

    const editBtns = screen.getAllByTestId("edit-webhook-btn");
    await userEvent.click(editBtns[0]);

    expect(screen.getByTestId("webhook-modal")).toBeInTheDocument();
    // URL should be pre-filled
    const urlInput = screen.getByTestId("webhook-url-input") as HTMLInputElement;
    expect(urlInput.value).toBe("https://example.com/hook1");
  });

  it("calls updateWebhook on edit save", async () => {
    setupQueries({ "webhooks:getWebhookEndpoints": WEBHOOK_ENDPOINTS });
    renderWithProviders(<WebhooksTab orgId={ORG_ID} />);

    const editBtns = screen.getAllByTestId("edit-webhook-btn");
    await userEvent.click(editBtns[0]);

    // Change URL
    const urlInput = screen.getByTestId("webhook-url-input");
    await userEvent.clear(urlInput);
    await userEvent.type(urlInput, "https://updated-hook.com");

    await userEvent.click(screen.getByTestId("webhook-save-btn"));

    const updateMut = mutationMap.get("webhooks:updateWebhook");
    expect(updateMut).toHaveBeenCalledWith(
      expect.objectContaining({
        webhookId: "wh_1",
        url: "https://updated-hook.com",
      })
    );
  });

  it("shows delete confirmation and calls deleteWebhook", async () => {
    setupQueries({ "webhooks:getWebhookEndpoints": WEBHOOK_ENDPOINTS });
    renderWithProviders(<WebhooksTab orgId={ORG_ID} />);

    const deleteBtns = screen.getAllByTestId("delete-webhook-btn");
    await userEvent.click(deleteBtns[0]);

    // Confirm delete should now be visible
    const confirmBtn = screen.getByTestId("confirm-delete-btn");
    expect(confirmBtn).toBeInTheDocument();

    await userEvent.click(confirmBtn);

    const deleteMut = mutationMap.get("webhooks:deleteWebhook");
    expect(deleteMut).toHaveBeenCalledWith({ webhookId: "wh_1" });
  });

  it("calls testWebhook action when test button clicked", async () => {
    setupQueries({ "webhooks:getWebhookEndpoints": WEBHOOK_ENDPOINTS });
    renderWithProviders(<WebhooksTab orgId={ORG_ID} />);

    const testBtns = screen.getAllByTestId("test-webhook-btn");
    await userEvent.click(testBtns[0]);

    expect(actionFn).toHaveBeenCalledWith({ webhookId: "wh_1" });
  });

  it("toggles pause/resume on status button click", async () => {
    setupQueries({ "webhooks:getWebhookEndpoints": WEBHOOK_ENDPOINTS });
    renderWithProviders(<WebhooksTab orgId={ORG_ID} />);

    const toggleBtns = screen.getAllByTestId("toggle-status-btn");
    // First webhook is active -> clicking should pause
    await userEvent.click(toggleBtns[0]);

    const updateMut = mutationMap.get("webhooks:updateWebhook");
    expect(updateMut).toHaveBeenCalledWith({
      webhookId: "wh_1",
      status: "paused",
    });
  });

  it("shows delivery log when expanded", async () => {
    setupQueries({
      "webhooks:getWebhookEndpoints": WEBHOOK_ENDPOINTS,
      "webhooks:getWebhookDeliveries": WEBHOOK_DELIVERIES,
    });
    renderWithProviders(<WebhooksTab orgId={ORG_ID} />);

    const toggleBtns = screen.getAllByTestId("toggle-deliveries-btn");
    await userEvent.click(toggleBtns[0]);

    expect(screen.getByTestId("delivery-log")).toBeInTheDocument();
    const rows = screen.getAllByTestId("delivery-row");
    expect(rows).toHaveLength(2);
  });

  it("shows status code badges in delivery log", async () => {
    setupQueries({
      "webhooks:getWebhookEndpoints": WEBHOOK_ENDPOINTS,
      "webhooks:getWebhookDeliveries": WEBHOOK_DELIVERIES,
    });
    renderWithProviders(<WebhooksTab orgId={ORG_ID} />);

    const toggleBtns = screen.getAllByTestId("toggle-deliveries-btn");
    await userEvent.click(toggleBtns[0]);

    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: IntegrationsPanel
// ---------------------------------------------------------------------------

describe("IntegrationsPanel", () => {
  it("renders Slack and Zapier integration cards", () => {
    renderWithProviders(<IntegrationsPanel />);

    expect(screen.getByTestId("integrations-panel")).toBeInTheDocument();
    expect(screen.getByTestId("slack-integration")).toBeInTheDocument();
    expect(screen.getByTestId("zapier-integration")).toBeInTheDocument();
  });

  it("renders Slack connect button initially", () => {
    renderWithProviders(<IntegrationsPanel />);
    expect(screen.getByTestId("connect-slack-btn")).toBeInTheDocument();
    expect(screen.getByTestId("slack-url-input")).toBeInTheDocument();
  });

  it("shows disconnect button after Slack connection", async () => {
    renderWithProviders(<IntegrationsPanel />);

    const urlInput = screen.getByTestId("slack-url-input");
    await userEvent.type(urlInput, "https://hooks.slack.com/services/xxx");
    await userEvent.click(screen.getByTestId("connect-slack-btn"));

    expect(screen.getByTestId("disconnect-slack-btn")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("renders Zapier webhook URL", () => {
    renderWithProviders(<IntegrationsPanel webhookUrl="https://my-app.com/api/webhooks/zapier" />);
    const zapierInput = screen.getByTestId("zapier-url-input") as HTMLInputElement;
    expect(zapierInput.value).toBe("https://my-app.com/api/webhooks/zapier");
  });

  it("has a copy button for Zapier webhook URL", () => {
    renderWithProviders(<IntegrationsPanel />);
    expect(screen.getByTestId("copy-zapier-url-btn")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: Translation key coverage
// ---------------------------------------------------------------------------

describe("Translation key coverage", () => {
  it("EN locale has all required webhook keys", async () => {
    const en = await import("@/messages/en/webhooks.json");
    const requiredKeys = [
      "title", "description", "addWebhook", "editWebhook", "deleteWebhook",
      "testWebhook", "url", "secret", "events", "status", "active", "paused",
      "failed", "deliveries", "noWebhooks", "confirmDelete", "testSent",
      "integrations", "slack", "zapier", "slackWebhookUrl", "connectSlack",
      "disconnectSlack",
    ];
    for (const key of requiredKeys) {
      expect(en).toHaveProperty(key);
    }
    // Nested event types
    expect(en).toHaveProperty("eventTypes.position_changed");
    expect(en).toHaveProperty("eventTypes.alert_triggered");
    expect(en).toHaveProperty("eventTypes.keyword_added");
    expect(en).toHaveProperty("eventTypes.competitor_detected");
    expect(en).toHaveProperty("eventTypes.backlink_lost");
  });

  it("PL locale has all required webhook keys", async () => {
    const pl = await import("@/messages/pl/webhooks.json");
    const requiredKeys = [
      "title", "description", "addWebhook", "editWebhook", "deleteWebhook",
      "testWebhook", "url", "secret", "events", "status", "active", "paused",
      "failed", "deliveries", "noWebhooks", "confirmDelete", "testSent",
      "integrations", "slack", "zapier", "slackWebhookUrl", "connectSlack",
      "disconnectSlack",
    ];
    for (const key of requiredKeys) {
      expect(pl).toHaveProperty(key);
    }
    expect(pl).toHaveProperty("eventTypes.position_changed");
    expect(pl).toHaveProperty("eventTypes.alert_triggered");
    expect(pl).toHaveProperty("eventTypes.keyword_added");
    expect(pl).toHaveProperty("eventTypes.competitor_detected");
    expect(pl).toHaveProperty("eventTypes.backlink_lost");
  });
});
