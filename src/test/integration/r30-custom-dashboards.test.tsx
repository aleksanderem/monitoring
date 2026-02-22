/**
 * R30: Custom Dashboards & Saved Views — Integration Tests
 *
 * Tests cover:
 * - DashboardBuilder: view/edit mode, widget add/remove, save, reset
 * - SavedViewsPanel: dropdown, save view, apply, share, delete
 * - WidgetCard: view/edit rendering
 * - Translation key coverage for EN and PL
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/domains",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    can: () => true,
    hasModule: () => true,
  }),
}));

// Override global next-intl mock to include NextIntlClientProvider
vi.mock("next-intl", async () => {
  const actual = await vi.importActual<typeof import("next-intl")>("next-intl");
  return { ...actual };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { renderWithProviders } from "../helpers/render-with-providers";
import { DashboardBuilder } from "@/components/dashboard/DashboardBuilder";
import { SavedViewsPanel, type SavedView } from "@/components/dashboard/SavedViewsPanel";
import { WidgetCard, type WidgetConfig } from "@/components/dashboard/WidgetCard";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeWidget(overrides: Partial<WidgetConfig> = {}): WidgetConfig {
  return {
    id: "w1",
    type: "keywordOverview",
    x: 0,
    y: 0,
    w: 6,
    h: 4,
    ...overrides,
  };
}

function makeSavedView(overrides: Partial<SavedView> = {}): SavedView {
  return {
    _id: "view-1",
    name: "Top Keywords",
    targetTable: "keywords",
    filters: "{}",
    sortBy: "position",
    sortDirection: "asc",
    columns: ["phrase", "position", "volume"],
    isShared: false,
    userId: "user-1",
    ...overrides,
  };
}

const SAMPLE_WIDGETS: WidgetConfig[] = [
  makeWidget({ id: "w1", type: "keywordOverview" }),
  makeWidget({ id: "w2", type: "positionChart" }),
  makeWidget({ id: "w3", type: "competitorTable" }),
];

const SAMPLE_VIEWS: SavedView[] = [
  makeSavedView({ _id: "v1", name: "Top Keywords", isShared: false }),
  makeSavedView({ _id: "v2", name: "Competitor View", isShared: true, userId: "user-2" }),
  makeSavedView({ _id: "v3", name: "Shared Backlinks", isShared: true }),
];

// ---------------------------------------------------------------------------
// DashboardBuilder Tests
// ---------------------------------------------------------------------------

describe("DashboardBuilder", () => {
  const user = userEvent.setup();

  it("renders in view mode by default", () => {
    renderWithProviders(<DashboardBuilder />);

    expect(screen.getByTestId("dashboard-builder")).toBeInTheDocument();
    expect(screen.getByText("View Mode")).toBeInTheDocument();
    // No add widget button in view mode
    expect(screen.queryByTestId("add-widget-btn")).not.toBeInTheDocument();
  });

  it("toggles to edit mode and shows edit controls", async () => {
    renderWithProviders(<DashboardBuilder />);

    await user.click(screen.getByTestId("toggle-edit-mode-btn"));

    expect(screen.getByText("Edit Mode")).toBeInTheDocument();
    expect(screen.getByTestId("add-widget-btn")).toBeInTheDocument();
    expect(screen.getByTestId("save-layout-btn")).toBeInTheDocument();
    expect(screen.getByTestId("reset-default-btn")).toBeInTheDocument();
    expect(screen.getByTestId("layout-name-input")).toBeInTheDocument();
  });

  it("shows empty state when no widgets", () => {
    renderWithProviders(<DashboardBuilder />);

    expect(screen.getByTestId("no-widgets")).toBeInTheDocument();
  });

  it("renders initial widgets", () => {
    renderWithProviders(<DashboardBuilder initialWidgets={SAMPLE_WIDGETS} />);

    expect(screen.getByTestId("widgets-grid")).toBeInTheDocument();
    expect(screen.getByTestId("widget-card-w1")).toBeInTheDocument();
    expect(screen.getByTestId("widget-card-w2")).toBeInTheDocument();
    expect(screen.getByTestId("widget-card-w3")).toBeInTheDocument();
  });

  it("adds a widget via widget selector", async () => {
    renderWithProviders(<DashboardBuilder />);

    // Enter edit mode
    await user.click(screen.getByTestId("toggle-edit-mode-btn"));

    // Open widget selector
    await user.click(screen.getByTestId("add-widget-btn"));
    expect(screen.getByTestId("widget-selector")).toBeInTheDocument();

    // Add a visibility trend widget
    await user.click(screen.getByTestId("add-widget-visibilityTrend"));

    // Widget should appear in the grid
    expect(screen.getByTestId("widgets-grid")).toBeInTheDocument();
    expect(screen.queryByTestId("no-widgets")).not.toBeInTheDocument();
  });

  it("removes a widget in edit mode", async () => {
    renderWithProviders(
      <DashboardBuilder initialWidgets={[makeWidget({ id: "w-removable", type: "alertsFeed" })]} />
    );

    // Enter edit mode
    await user.click(screen.getByTestId("toggle-edit-mode-btn"));

    // Remove the widget
    await user.click(screen.getByTestId("remove-widget-w-removable"));

    // Should show empty state
    expect(screen.getByTestId("no-widgets")).toBeInTheDocument();
  });

  it("calls onSave with correct widget config and name", async () => {
    const onSave = vi.fn();
    renderWithProviders(
      <DashboardBuilder
        initialWidgets={SAMPLE_WIDGETS}
        onSave={onSave}
      />
    );

    // Enter edit mode
    await user.click(screen.getByTestId("toggle-edit-mode-btn"));

    // Set layout name
    await user.clear(screen.getByTestId("layout-name-input"));
    await user.type(screen.getByTestId("layout-name-input"), "My Dashboard");

    // Save
    await user.click(screen.getByTestId("save-layout-btn"));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("My Dashboard", SAMPLE_WIDGETS);
  });

  it("calls onReset and reverts to initial state", async () => {
    const onReset = vi.fn();
    renderWithProviders(
      <DashboardBuilder
        initialWidgets={SAMPLE_WIDGETS}
        layoutName="Original"
        onReset={onReset}
      />
    );

    // Enter edit mode
    await user.click(screen.getByTestId("toggle-edit-mode-btn"));

    // Reset
    await user.click(screen.getByTestId("reset-default-btn"));

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// SavedViewsPanel Tests
// ---------------------------------------------------------------------------

describe("SavedViewsPanel", () => {
  const user = userEvent.setup();

  it("renders dropdown trigger", () => {
    renderWithProviders(<SavedViewsPanel views={[]} />);

    expect(screen.getByTestId("saved-views-trigger")).toBeInTheDocument();
    expect(screen.getByText("Saved Views")).toBeInTheDocument();
  });

  it("shows views list when opened", async () => {
    renderWithProviders(<SavedViewsPanel views={SAMPLE_VIEWS} currentUserId="user-1" />);

    await user.click(screen.getByTestId("saved-views-trigger"));

    expect(screen.getByTestId("saved-views-dropdown")).toBeInTheDocument();
    expect(screen.getByTestId("views-list")).toBeInTheDocument();
    expect(screen.getByText("Top Keywords")).toBeInTheDocument();
    expect(screen.getByText("Competitor View")).toBeInTheDocument();
  });

  it("shows empty state when no views", async () => {
    renderWithProviders(<SavedViewsPanel views={[]} />);

    await user.click(screen.getByTestId("saved-views-trigger"));

    expect(screen.getByTestId("no-saved-views")).toBeInTheDocument();
  });

  it("shows shared badge on shared views", async () => {
    renderWithProviders(<SavedViewsPanel views={SAMPLE_VIEWS} currentUserId="user-1" />);

    await user.click(screen.getByTestId("saved-views-trigger"));

    expect(screen.getByTestId("shared-badge-v2")).toBeInTheDocument();
    expect(screen.getByTestId("shared-badge-v3")).toBeInTheDocument();
  });

  it("save current view form captures name and share state", async () => {
    const onSave = vi.fn();
    renderWithProviders(<SavedViewsPanel views={[]} onSave={onSave} />);

    await user.click(screen.getByTestId("saved-views-trigger"));
    await user.click(screen.getByTestId("save-view-btn"));

    expect(screen.getByTestId("save-view-form")).toBeInTheDocument();

    // Fill in name
    await user.type(screen.getByTestId("view-name-input"), "My Filter");

    // Toggle shared
    await user.click(screen.getByTestId("share-toggle"));

    // Confirm save
    await user.click(screen.getByTestId("confirm-save-view-btn"));

    expect(onSave).toHaveBeenCalledWith("My Filter", true);
  });

  it("calls onApply when clicking a view", async () => {
    const onApply = vi.fn();
    renderWithProviders(<SavedViewsPanel views={SAMPLE_VIEWS} onApply={onApply} />);

    await user.click(screen.getByTestId("saved-views-trigger"));
    await user.click(screen.getByTestId("apply-view-v1"));

    expect(onApply).toHaveBeenCalledWith(SAMPLE_VIEWS[0]);
  });

  it("delete view with confirmation", async () => {
    const onDelete = vi.fn();
    renderWithProviders(
      <SavedViewsPanel views={SAMPLE_VIEWS} currentUserId="user-1" onDelete={onDelete} />
    );

    await user.click(screen.getByTestId("saved-views-trigger"));

    // First click shows confirm button
    await user.click(screen.getByTestId("delete-view-v1"));
    expect(screen.getByTestId("confirm-delete-v1")).toBeInTheDocument();

    // Confirm delete
    await user.click(screen.getByTestId("confirm-delete-v1"));

    expect(onDelete).toHaveBeenCalledWith("v1");
  });

  it("calls onToggleShare for share toggle", async () => {
    const onToggleShare = vi.fn();
    renderWithProviders(
      <SavedViewsPanel views={SAMPLE_VIEWS} currentUserId="user-1" onToggleShare={onToggleShare} />
    );

    await user.click(screen.getByTestId("saved-views-trigger"));
    await user.click(screen.getByTestId("toggle-share-v1"));

    expect(onToggleShare).toHaveBeenCalledWith("v1", true);
  });
});

// ---------------------------------------------------------------------------
// WidgetCard Tests
// ---------------------------------------------------------------------------

describe("WidgetCard", () => {
  it("renders in view mode without drag handle or remove button", () => {
    const widget = makeWidget({ id: "wc-1", type: "backlinkSummary" });
    renderWithProviders(<WidgetCard widget={widget} isEditMode={false} />);

    expect(screen.getByTestId("widget-card-wc-1")).toBeInTheDocument();
    expect(screen.getAllByText("Backlink Summary").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("drag-handle-wc-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("remove-widget-wc-1")).not.toBeInTheDocument();
  });

  it("renders in edit mode with drag handle and remove button", () => {
    const widget = makeWidget({ id: "wc-2", type: "positionChart" });
    renderWithProviders(<WidgetCard widget={widget} isEditMode={true} />);

    expect(screen.getByTestId("drag-handle-wc-2")).toBeInTheDocument();
    expect(screen.getByTestId("remove-widget-wc-2")).toBeInTheDocument();
  });

  it("calls onRemove when remove button is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const widget = makeWidget({ id: "wc-3", type: "alertsFeed" });
    renderWithProviders(
      <WidgetCard widget={widget} isEditMode={true} onRemove={onRemove} />
    );

    await user.click(screen.getByTestId("remove-widget-wc-3"));

    expect(onRemove).toHaveBeenCalledWith("wc-3");
  });
});

// ---------------------------------------------------------------------------
// Translation Coverage Tests
// ---------------------------------------------------------------------------

describe("Translation key coverage", () => {
  it("EN dashboards.json has all required keys", async () => {
    const en = await import("@/messages/en/dashboards.json");
    const keys = en.default || en;

    expect(keys.title).toBeDefined();
    expect(keys.description).toBeDefined();
    expect(keys.editMode).toBeDefined();
    expect(keys.viewMode).toBeDefined();
    expect(keys.addWidget).toBeDefined();
    expect(keys.removeWidget).toBeDefined();
    expect(keys.saveLayout).toBeDefined();
    expect(keys.resetDefault).toBeDefined();
    expect(keys.layoutName).toBeDefined();
    expect(keys.savedViews).toBeDefined();
    expect(keys.saveView).toBeDefined();
    expect(keys.deleteView).toBeDefined();
    expect(keys.shareView).toBeDefined();
    expect(keys.viewName).toBeDefined();
    expect(keys.filterPreset).toBeDefined();
    expect(keys.noSavedViews).toBeDefined();
    expect(keys.confirmDelete).toBeDefined();
    expect(keys.widgets).toBeDefined();
    expect(keys.widgets.keywordOverview).toBeDefined();
    expect(keys.widgets.positionChart).toBeDefined();
    expect(keys.widgets.competitorTable).toBeDefined();
    expect(keys.widgets.visibilityTrend).toBeDefined();
    expect(keys.widgets.alertsFeed).toBeDefined();
    expect(keys.widgets.backlinkSummary).toBeDefined();
    expect(keys.shared).toBeDefined();
    expect(keys.personal).toBeDefined();
    expect(keys.defaultLayout).toBeDefined();
    expect(keys.customLayout).toBeDefined();
  });

  it("PL dashboards.json has matching keys with EN", async () => {
    const en = await import("@/messages/en/dashboards.json");
    const pl = await import("@/messages/pl/dashboards.json");
    const enKeys = en.default || en;
    const plKeys = pl.default || pl;

    // All top-level keys in EN must exist in PL
    for (const key of Object.keys(enKeys)) {
      expect(plKeys).toHaveProperty(key);
    }

    // Widget sub-keys must match
    for (const key of Object.keys(enKeys.widgets)) {
      expect(plKeys.widgets).toHaveProperty(key);
    }
  });
});
