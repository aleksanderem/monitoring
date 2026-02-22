/**
 * R31: Scheduled Report Delivery — Integration Tests
 *
 * Tests the ScheduleManager and ScheduleForm components with mock Convex queries/mutations.
 * Covers: loading, empty, populated, create, edit, delete, toggle, run now, form validation,
 * recipient management, frequency-specific day selectors, and locale key parity.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
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
  useMutation: vi.fn(((ref: unknown) => {
    const key = getFunctionName(ref as any);
    if (!mutationMap.has(key)) mutationMap.set(key, vi.fn().mockResolvedValue(undefined));
    return mutationMap.get(key)!;
  }) as any),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/reports/schedules",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    permissions: ["reports.create", "reports.share"],
    modules: ["reports"],
    role: "admin",
    plan: { name: "Pro", key: "pro" },
    isLoading: false,
    can: () => true,
    hasModule: () => true,
  }),
}));

vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissionsContext: () => ({
    permissions: ["reports.create"],
    modules: ["reports"],
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

// Use real next-intl translations
vi.mock("next-intl", async () => {
  const actual = await vi.importActual<typeof import("next-intl")>("next-intl");
  return { ...actual };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useQuery, useMutation } from "convex/react";
import { renderWithProviders } from "@/test/helpers/render-with-providers";
import { ScheduleManager } from "@/components/reports/ScheduleManager";
import { ScheduleForm, type ScheduleFormData } from "@/components/reports/ScheduleForm";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_ID = "org_1" as any;
const DOMAIN_ID = "domain_1" as any;

function makeSchedule(overrides: Record<string, unknown> = {}) {
  return {
    _id: "sched_1" as any,
    _creationTime: Date.now(),
    orgId: ORG_ID,
    domainId: DOMAIN_ID,
    name: "Weekly Executive Report",
    reportType: "executive" as const,
    frequency: "weekly" as const,
    dayOfWeek: 1,
    recipients: ["alice@test.com", "bob@test.com"],
    isActive: true,
    lastRunAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    nextRunAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    createdBy: "user_1" as any,
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

const SCHEDULE_ACTIVE = makeSchedule();
const SCHEDULE_PAUSED = makeSchedule({
  _id: "sched_2",
  name: "Monthly Competitor Report",
  reportType: "competitor",
  frequency: "monthly",
  dayOfMonth: 15,
  isActive: false,
  dayOfWeek: undefined,
});
const SCHEDULE_LIST = [SCHEDULE_ACTIVE, SCHEDULE_PAUSED];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupQueryMock(responses: Record<string, unknown>) {
  vi.mocked(useQuery).mockImplementation(((ref: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    const key = getFunctionName(ref as any);
    return responses[key] ?? undefined;
  }) as any);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("R31: ScheduleManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutationMap.clear();
  });

  it("shows loading state when schedules are undefined", () => {
    setupQueryMock({});
    renderWithProviders(<ScheduleManager orgId={ORG_ID} />);
    expect(screen.getByTestId("loading-state")).toBeInTheDocument();
  });

  it("shows empty state when no schedules exist", () => {
    setupQueryMock({ "scheduledReports:getSchedules": [] });
    renderWithProviders(<ScheduleManager orgId={ORG_ID} />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByText(/No report schedules yet/)).toBeInTheDocument();
  });

  it("renders schedule list with correct data", () => {
    setupQueryMock({ "scheduledReports:getSchedules": SCHEDULE_LIST });
    renderWithProviders(<ScheduleManager orgId={ORG_ID} />);

    expect(screen.getByTestId("schedules-list")).toBeInTheDocument();
    expect(screen.getByText("Weekly Executive Report")).toBeInTheDocument();
    expect(screen.getByText("Monthly Competitor Report")).toBeInTheDocument();
  });

  it("shows active/paused badges correctly", () => {
    setupQueryMock({ "scheduledReports:getSchedules": SCHEDULE_LIST });
    renderWithProviders(<ScheduleManager orgId={ORG_ID} />);

    const badges = screen.getAllByText(/Active|Paused/);
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });

  it("opens create form when Add Schedule is clicked", async () => {
    setupQueryMock({ "scheduledReports:getSchedules": [] });
    renderWithProviders(<ScheduleManager orgId={ORG_ID} />);

    const addBtn = screen.getByTestId("add-schedule-btn");
    await userEvent.click(addBtn);

    expect(screen.getByTestId("create-form-container")).toBeInTheDocument();
    expect(screen.getByTestId("schedule-form")).toBeInTheDocument();
  });

  it("creates schedule with correct mutation args", async () => {
    setupQueryMock({ "scheduledReports:getSchedules": [] });
    renderWithProviders(<ScheduleManager orgId={ORG_ID} domainId={DOMAIN_ID} />);

    await userEvent.click(screen.getByTestId("add-schedule-btn"));

    // Fill form
    await userEvent.type(screen.getByTestId("schedule-name-input"), "My Weekly Report");

    // Add recipient
    await userEvent.type(screen.getByTestId("recipient-input"), "test@example.com");
    await userEvent.click(screen.getByTestId("add-recipient-btn"));

    // Submit
    await userEvent.click(screen.getByTestId("submit-schedule-btn"));

    const createFn = mutationMap.get("scheduledReports:createSchedule");
    expect(createFn).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: ORG_ID,
        domainId: DOMAIN_ID,
        name: "My Weekly Report",
        reportType: "executive",
        frequency: "weekly",
        recipients: ["test@example.com"],
      })
    );
  });

  it("shows edit form when edit button is clicked", async () => {
    setupQueryMock({ "scheduledReports:getSchedules": [SCHEDULE_ACTIVE] });
    renderWithProviders(<ScheduleManager orgId={ORG_ID} />);

    const editBtn = screen.getByTestId(`edit-${SCHEDULE_ACTIVE._id}`);
    await userEvent.click(editBtn);

    expect(screen.getByTestId("schedule-form")).toBeInTheDocument();
  });

  it("shows delete confirmation when delete button is clicked", async () => {
    setupQueryMock({ "scheduledReports:getSchedules": [SCHEDULE_ACTIVE] });
    renderWithProviders(<ScheduleManager orgId={ORG_ID} />);

    const deleteBtn = screen.getByTestId(`delete-${SCHEDULE_ACTIVE._id}`);
    await userEvent.click(deleteBtn);

    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
    expect(screen.getByTestId("confirm-delete-btn")).toBeInTheDocument();
  });

  it("calls delete mutation on confirmation", async () => {
    setupQueryMock({ "scheduledReports:getSchedules": [SCHEDULE_ACTIVE] });
    renderWithProviders(<ScheduleManager orgId={ORG_ID} />);

    await userEvent.click(screen.getByTestId(`delete-${SCHEDULE_ACTIVE._id}`));
    await userEvent.click(screen.getByTestId("confirm-delete-btn"));

    const deleteFn = mutationMap.get("scheduledReports:deleteSchedule");
    expect(deleteFn).toHaveBeenCalledWith(
      expect.objectContaining({ scheduleId: SCHEDULE_ACTIVE._id })
    );
  });

  it("calls toggle mutation when toggle button is clicked", async () => {
    setupQueryMock({ "scheduledReports:getSchedules": [SCHEDULE_ACTIVE] });
    renderWithProviders(<ScheduleManager orgId={ORG_ID} />);

    const toggleBtn = screen.getByTestId(`toggle-${SCHEDULE_ACTIVE._id}`);
    await userEvent.click(toggleBtn);

    const toggleFn = mutationMap.get("scheduledReports:toggleSchedule");
    expect(toggleFn).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleId: SCHEDULE_ACTIVE._id,
        isActive: false,
      })
    );
  });

  it("calls runScheduleNow mutation when Run Now is clicked", async () => {
    // Mock confirm dialog
    vi.spyOn(window, "confirm").mockReturnValue(true);

    setupQueryMock({ "scheduledReports:getSchedules": [SCHEDULE_ACTIVE] });
    renderWithProviders(<ScheduleManager orgId={ORG_ID} />);

    const runBtn = screen.getByTestId(`run-now-${SCHEDULE_ACTIVE._id}`);
    await userEvent.click(runBtn);

    const runNowFn = mutationMap.get("scheduledReports:runScheduleNow");
    expect(runNowFn).toHaveBeenCalledWith(
      expect.objectContaining({ scheduleId: SCHEDULE_ACTIVE._id })
    );
  });
});

describe("R31: ScheduleForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates required name field", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <ScheduleForm onSubmit={onSubmit} onCancel={vi.fn()} />
    );

    // Add a recipient so only name validation fires
    await userEvent.type(screen.getByTestId("recipient-input"), "test@test.com");
    await userEvent.click(screen.getByTestId("add-recipient-btn"));

    await userEvent.click(screen.getByTestId("submit-schedule-btn"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Name is required")).toBeInTheDocument();
  });

  it("validates at least one recipient is required", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <ScheduleForm onSubmit={onSubmit} onCancel={vi.fn()} />
    );

    await userEvent.type(screen.getByTestId("schedule-name-input"), "Test Schedule");
    await userEvent.click(screen.getByTestId("submit-schedule-btn"));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("At least one recipient is required")).toBeInTheDocument();
  });

  it("adds and removes recipients correctly", async () => {
    renderWithProviders(
      <ScheduleForm onSubmit={vi.fn()} onCancel={vi.fn()} />
    );

    // Add first recipient
    await userEvent.type(screen.getByTestId("recipient-input"), "one@test.com");
    await userEvent.click(screen.getByTestId("add-recipient-btn"));
    expect(screen.getByText("one@test.com")).toBeInTheDocument();

    // Add second recipient
    await userEvent.type(screen.getByTestId("recipient-input"), "two@test.com");
    await userEvent.click(screen.getByTestId("add-recipient-btn"));
    expect(screen.getByText("two@test.com")).toBeInTheDocument();

    // Remove first
    await userEvent.click(screen.getByTestId("remove-recipient-one@test.com"));
    expect(screen.queryByText("one@test.com")).not.toBeInTheDocument();
    expect(screen.getByText("two@test.com")).toBeInTheDocument();
  });

  it("shows day-of-week selector for weekly frequency", () => {
    renderWithProviders(
      <ScheduleForm onSubmit={vi.fn()} onCancel={vi.fn()} />
    );

    expect(screen.getByTestId("day-of-week-select")).toBeInTheDocument();
    expect(screen.queryByTestId("day-of-month-select")).not.toBeInTheDocument();
  });

  it("shows day-of-month selector for monthly frequency", async () => {
    renderWithProviders(
      <ScheduleForm onSubmit={vi.fn()} onCancel={vi.fn()} />
    );

    const freqSelect = screen.getByTestId("frequency-select");
    await userEvent.selectOptions(freqSelect, "monthly");

    expect(screen.getByTestId("day-of-month-select")).toBeInTheDocument();
    expect(screen.queryByTestId("day-of-week-select")).not.toBeInTheDocument();
  });

  it("submits correct data for a complete form", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <ScheduleForm onSubmit={onSubmit} onCancel={vi.fn()} />
    );

    await userEvent.type(screen.getByTestId("schedule-name-input"), "Test Report");
    await userEvent.selectOptions(screen.getByTestId("report-type-select"), "keyword");
    await userEvent.selectOptions(screen.getByTestId("frequency-select"), "biweekly");
    await userEvent.selectOptions(screen.getByTestId("day-of-week-select"), "5");

    await userEvent.type(screen.getByTestId("recipient-input"), "boss@company.com");
    await userEvent.click(screen.getByTestId("add-recipient-btn"));

    await userEvent.click(screen.getByTestId("submit-schedule-btn"));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Test Report",
      reportType: "keyword",
      frequency: "biweekly",
      dayOfWeek: 5,
      dayOfMonth: undefined,
      recipients: ["boss@company.com"],
    });
  });

  it("rejects invalid email addresses", async () => {
    renderWithProviders(
      <ScheduleForm onSubmit={vi.fn()} onCancel={vi.fn()} />
    );

    await userEvent.type(screen.getByTestId("recipient-input"), "not-an-email");
    await userEvent.click(screen.getByTestId("add-recipient-btn"));

    expect(screen.getByText("Invalid email address")).toBeInTheDocument();
    expect(screen.queryByTestId("recipients-list")).not.toBeInTheDocument();
  });
});

describe("R31: Translation key parity", () => {
  const LOCALES = ["en", "pl", "de", "es", "fr"];
  const messagesDir = path.resolve(__dirname, "../../messages");

  it("all 5 locales have scheduledReports.json with matching keys", () => {
    const enKeys = Object.keys(
      JSON.parse(fs.readFileSync(path.join(messagesDir, "en/scheduledReports.json"), "utf-8"))
    ).sort();

    for (const locale of LOCALES) {
      const filePath = path.join(messagesDir, `${locale}/scheduledReports.json`);
      expect(fs.existsSync(filePath), `${locale}/scheduledReports.json should exist`).toBe(true);

      const localeKeys = Object.keys(
        JSON.parse(fs.readFileSync(filePath, "utf-8"))
      ).sort();

      expect(localeKeys).toEqual(enKeys);
    }
  });
});
