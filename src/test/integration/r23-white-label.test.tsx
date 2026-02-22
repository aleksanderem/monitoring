/**
 * Integration tests for R23: White-Label & Agency Features.
 *
 * Tests ClientManagement and WhiteLabelTab components with mocked Convex queries.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mutationMap = new Map<string, ReturnType<typeof vi.fn>>();

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn((ref: unknown) => {
    try {
      const key = getFunctionName(ref as any);
      if (!mutationMap.has(key)) mutationMap.set(key, vi.fn().mockResolvedValue(undefined));
      return mutationMap.get(key)!;
    } catch {
      return vi.fn();
    }
  }),
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
    permissions: ["org.settings.view", "org.settings.edit"],
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
    permissions: ["org.settings.view", "org.settings.edit"],
    modules: ["positioning"],
    role: "admin",
    plan: { name: "Pro", key: "pro" },
    isLoading: false,
    can: () => true,
    hasModule: () => true,
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

vi.mock("@/components/shared/LoadingState", () => ({
  LoadingState: (props: Record<string, unknown>) => (
    <div data-testid="loading-state" data-type={props.type}>Loading...</div>
  ),
}));

vi.mock("@/components/ui/glowing-effect", () => ({
  GlowingEffect: () => null,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

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

import { useQuery, useMutation } from "convex/react";
import { renderWithProviders } from "@/test/helpers/render-with-providers";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_ID = "org_agency_1" as any;

const ACTIVE_CLIENTS = [
  {
    _id: "ac_1" as any,
    agencyOrgId: ORG_ID,
    clientOrgId: "org_client_1" as any,
    status: "active" as const,
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    addedBy: "user_1" as any,
    clientName: "Acme Corp",
    clientSlug: "acme-corp",
  },
  {
    _id: "ac_2" as any,
    agencyOrgId: ORG_ID,
    clientOrgId: "org_client_2" as any,
    status: "suspended" as const,
    createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    addedBy: "user_1" as any,
    clientName: "Beta Industries",
    clientSlug: "beta-industries",
  },
];

const BRANDING_DATA = {
  _id: "bo_1" as any,
  orgId: ORG_ID,
  logoUrl: "https://example.com/logo.png",
  primaryColor: "#FF5733",
  accentColor: "#33FF57",
  companyName: "My Agency",
  customDomain: "seo.myagency.com",
  footerText: "Powered by My Agency",
  reportHeaderHtml: "<h1>My Agency</h1>",
};

// ---------------------------------------------------------------------------
// Query mock helper
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

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let ClientManagement: React.ComponentType<{ organizationId: any }>;
let WhiteLabelTab: React.ComponentType<{ organizationId: any }>;

beforeEach(async () => {
  vi.mocked(useQuery).mockImplementation((() => undefined) as any);
  mutationMap.clear();

  const clientMod = await import("@/components/agency/ClientManagement");
  ClientManagement = clientMod.ClientManagement;

  const brandingMod = await import("@/components/settings/WhiteLabelTab");
  WhiteLabelTab = brandingMod.WhiteLabelTab;
});

// ---------------------------------------------------------------------------
// Tests: ClientManagement
// ---------------------------------------------------------------------------

describe("ClientManagement", () => {
  it("renders loading state when clients query returns undefined", () => {
    renderWithProviders(<ClientManagement organizationId={ORG_ID} />);
    expect(screen.getByTestId("loading-state")).toBeInTheDocument();
  });

  it("renders empty state when no clients exist", () => {
    setupQueries({ "agency:getAgencyClients": [] });
    renderWithProviders(<ClientManagement organizationId={ORG_ID} />);
    expect(screen.getByText(/No clients yet/)).toBeInTheDocument();
  });

  it("renders client table with client names and statuses", () => {
    setupQueries({ "agency:getAgencyClients": ACTIVE_CLIENTS });
    renderWithProviders(<ClientManagement organizationId={ORG_ID} />);

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Beta Industries")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("suspended")).toBeInTheDocument();
  });

  it("renders client count summary", () => {
    setupQueries({ "agency:getAgencyClients": ACTIVE_CLIENTS });
    renderWithProviders(<ClientManagement organizationId={ORG_ID} />);
    expect(screen.getByText("2 clients")).toBeInTheDocument();
  });

  it("opens add client modal when clicking Add client button", async () => {
    const user = userEvent.setup();
    setupQueries({ "agency:getAgencyClients": [] });
    renderWithProviders(<ClientManagement organizationId={ORG_ID} />);

    // Click the Add client button (in the header, not the empty state)
    const addButtons = screen.getAllByText("Add client");
    await user.click(addButtons[0]);

    // Modal should now be visible
    expect(screen.getByText("Add new client")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Client organization name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("client-website.com")).toBeInTheDocument();
  });

  it("calls addClientOrg mutation with correct args when submitting add form", async () => {
    const user = userEvent.setup();
    setupQueries({ "agency:getAgencyClients": [] });
    renderWithProviders(<ClientManagement organizationId={ORG_ID} />);

    // Open modal
    const addButtons = screen.getAllByText("Add client");
    await user.click(addButtons[0]);

    // Fill in form
    const nameInput = screen.getByPlaceholderText("Client organization name");
    await user.type(nameInput, "New Client Inc");

    const domainInput = screen.getByPlaceholderText("client-website.com");
    await user.type(domainInput, "newclient.com");

    // Submit
    const submitButtons = screen.getAllByText("Add client");
    const submitButton = submitButtons[submitButtons.length - 1]; // last one is in the modal
    await user.click(submitButton);

    const addMutation = mutationMap.get("agency:addClientOrg");
    expect(addMutation).toHaveBeenCalledWith({
      agencyOrgId: ORG_ID,
      clientName: "New Client Inc",
      clientDomain: "newclient.com",
    });
  });

  it("shows suspend confirmation dialog", async () => {
    const user = userEvent.setup();
    setupQueries({ "agency:getAgencyClients": ACTIVE_CLIENTS });
    renderWithProviders(<ClientManagement organizationId={ORG_ID} />);

    const suspendButtons = screen.getAllByText("Suspend client");
    await user.click(suspendButtons[0]);

    expect(screen.getByText(/Are you sure you want to suspend this client/)).toBeInTheDocument();
  });

  it("shows remove confirmation dialog", async () => {
    const user = userEvent.setup();
    setupQueries({ "agency:getAgencyClients": ACTIVE_CLIENTS });
    renderWithProviders(<ClientManagement organizationId={ORG_ID} />);

    const removeButtons = screen.getAllByText("Remove client");
    await user.click(removeButtons[0]);

    expect(screen.getByText(/Are you sure you want to remove this client/)).toBeInTheDocument();
  });

  it("calls suspendClient mutation when confirming suspend", async () => {
    const user = userEvent.setup();
    setupQueries({ "agency:getAgencyClients": ACTIVE_CLIENTS });
    renderWithProviders(<ClientManagement organizationId={ORG_ID} />);

    // Click suspend on first active client
    const suspendButtons = screen.getAllByText("Suspend client");
    await user.click(suspendButtons[0]);

    // Confirm
    const confirmButton = screen.getByText("Confirm");
    await user.click(confirmButton);

    const suspendMutation = mutationMap.get("agency:suspendClient");
    expect(suspendMutation).toHaveBeenCalledWith({
      agencyOrgId: ORG_ID,
      clientOrgId: "org_client_1",
    });
  });

  it("calls removeClientOrg mutation when confirming remove", async () => {
    const user = userEvent.setup();
    setupQueries({ "agency:getAgencyClients": ACTIVE_CLIENTS });
    renderWithProviders(<ClientManagement organizationId={ORG_ID} />);

    // Click remove on first client
    const removeButtons = screen.getAllByText("Remove client");
    await user.click(removeButtons[0]);

    // Confirm
    const confirmButton = screen.getByText("Confirm");
    await user.click(confirmButton);

    const removeMutation = mutationMap.get("agency:removeClientOrg");
    expect(removeMutation).toHaveBeenCalledWith({
      agencyOrgId: ORG_ID,
      clientOrgId: "org_client_1",
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: WhiteLabelTab
// ---------------------------------------------------------------------------

describe("WhiteLabelTab", () => {
  it("renders loading state when branding query returns undefined", () => {
    renderWithProviders(<WhiteLabelTab organizationId={ORG_ID} />);
    expect(screen.getByTestId("loading-state")).toBeInTheDocument();
  });

  it("renders branding form with current values when data loaded", () => {
    setupQueries({ "agency:getClientBranding": BRANDING_DATA });
    renderWithProviders(<WhiteLabelTab organizationId={ORG_ID} />);

    expect(screen.getByText("Branding")).toBeInTheDocument();
    expect(screen.getByText("Primary color")).toBeInTheDocument();
    expect(screen.getByText("Accent color")).toBeInTheDocument();
    expect(screen.getByText("Branding preview")).toBeInTheDocument();
  });

  it("renders branding form with empty state when no branding exists", () => {
    setupQueries({ "agency:getClientBranding": null });
    renderWithProviders(<WhiteLabelTab organizationId={ORG_ID} />);

    expect(screen.getByText("Branding")).toBeInTheDocument();
    expect(screen.getByText("Save changes")).toBeInTheDocument();
    expect(screen.getByText("Reset to defaults")).toBeInTheDocument();
  });

  it("calls updateBrandingOverrides when clicking Save changes", async () => {
    const user = userEvent.setup();
    setupQueries({ "agency:getClientBranding": null });
    renderWithProviders(<WhiteLabelTab organizationId={ORG_ID} />);

    const saveButton = screen.getByText("Save changes");
    await user.click(saveButton);

    const updateMutation = mutationMap.get("agency:updateBrandingOverrides");
    expect(updateMutation).toHaveBeenCalled();
  });

  it("renders preview section with company name", () => {
    setupQueries({ "agency:getClientBranding": BRANDING_DATA });
    renderWithProviders(<WhiteLabelTab organizationId={ORG_ID} />);

    // Preview section shows company name
    expect(screen.getByText("Branding preview")).toBeInTheDocument();
    // The preview renders company name from state after initialization
    expect(screen.getByText("My Agency")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: Translation parity (EN & PL)
// ---------------------------------------------------------------------------

describe("Agency i18n parity", () => {
  const MESSAGES_DIR = path.resolve(__dirname, "../../messages");

  it("EN and PL agency.json have the same keys", () => {
    const enPath = path.join(MESSAGES_DIR, "en", "agency.json");
    const plPath = path.join(MESSAGES_DIR, "pl", "agency.json");

    expect(fs.existsSync(enPath), "EN agency.json should exist").toBe(true);
    expect(fs.existsSync(plPath), "PL agency.json should exist").toBe(true);

    const enKeys = Object.keys(JSON.parse(fs.readFileSync(enPath, "utf-8"))).sort();
    const plKeys = Object.keys(JSON.parse(fs.readFileSync(plPath, "utf-8"))).sort();

    expect(enKeys).toEqual(plKeys);
  });

  it("no empty string values in agency translation files", () => {
    for (const locale of ["en", "pl"]) {
      const filePath = path.join(MESSAGES_DIR, locale, "agency.json");
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const emptyKeys = Object.entries(data)
        .filter(([, v]) => v === "")
        .map(([k]) => k);

      expect(emptyKeys, `${locale}/agency.json has empty values: ${emptyKeys.join(", ")}`).toEqual([]);
    }
  });
});
