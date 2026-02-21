/**
 * R08 Phase 4 — Email Hygiene Tests
 *
 * Verifies:
 * 1. Unsubscribe link present in all non-transactional email templates
 * 2. Unsubscribe link NOT present in transactional emails
 * 3. logNotification is called after each email send with correct category
 * 4. logNotification handles error case (status: "failed")
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// We test by importing the raw source functions and examining their behavior.
// Since sendEmail.ts is a "use node" Convex action file, we mock the external
// dependencies (Resend, Convex internals) and invoke the handler directly.
// ---------------------------------------------------------------------------

// Hoisted mocks — must be defined before vi.mock calls
const { mockSend, mockRunAfter } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockRunAfter: vi.fn(),
}));

vi.mock("resend", () => {
  return {
    Resend: class {
      emails = { send: mockSend };
    },
  };
});

// Mock environment
vi.stubEnv("RESEND_API_KEY", "re_test_key");
vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.doseo.pl");

// ---------------------------------------------------------------------------
// We need to extract the handler functions from the internalAction wrappers.
// Convex's internalAction returns an object with args and handler.
// We'll import the module and call handlers directly with a mock ctx.
// ---------------------------------------------------------------------------

// Since the file uses "use node" directive and internalAction wrapper,
// we need to mock the Convex server module to capture the handlers.
const registeredActions: Record<string, { args: any; handler: Function }> = {};

vi.mock("../../../convex/_generated/server", () => ({
  internalAction: (config: { args: any; handler: Function }) => {
    return config; // Just return the config so we can call handler directly
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  internal: {
    scheduler: {
      logNotification: "internal.scheduler.logNotification",
    },
  },
}));

// Import the module - handlers are returned as-is due to our mock
import * as sendEmail from "../../../convex/actions/sendEmail";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx() {
  mockRunAfter.mockClear();
  return {
    scheduler: {
      runAfter: mockRunAfter,
    },
  };
}

const UNSUBSCRIBE_PATTERN = /settings\?tab=notifications/;
const UNSUBSCRIBE_TEXT_PATTERN = /Zarządzaj preferencjami email/;

/** Extract the HTML string from the most recent mockSend call */
function getLastSentHtml(): string {
  const lastCall = mockSend.mock.calls[mockSend.mock.calls.length - 1];
  return lastCall?.[0]?.html ?? "";
}

// ---------------------------------------------------------------------------
// Non-transactional email templates (SHOULD have unsubscribe link)
// ---------------------------------------------------------------------------

const NON_TRANSACTIONAL_TEMPLATES: Array<{
  name: string;
  exportName: keyof typeof sendEmail;
  args: Record<string, any>;
  expectedCategory: string;
}> = [
  {
    name: "sendDailyDigest",
    exportName: "sendDailyDigest",
    args: { to: "user@example.com", userName: "Jan", domainName: "example.com", totalKeywords: 50, gainers: [], losers: [] },
    expectedCategory: "digest",
  },
  {
    name: "sendWeeklyReport",
    exportName: "sendWeeklyReport",
    args: { to: "user@example.com", userName: "Jan", domainName: "example.com", totalKeywords: 50, top3: 2, top10: 8, top20: 15, top50: 30, improved: 10, declined: 5, stable: 35 },
    expectedCategory: "digest",
  },
  {
    name: "sendPositionDropAlert",
    exportName: "sendPositionDropAlert",
    args: { to: "user@example.com", domainName: "example.com", keywordPhrase: "seo tools", previousPosition: 3, currentPosition: 15 },
    expectedCategory: "alert",
  },
  {
    name: "sendTopNExitAlert",
    exportName: "sendTopNExitAlert",
    args: { to: "user@example.com", domainName: "example.com", keywordPhrase: "seo tools", previousPosition: 8, currentPosition: 12, topN: 10 },
    expectedCategory: "alert",
  },
  {
    name: "sendNewCompetitorAlert",
    exportName: "sendNewCompetitorAlert",
    args: { to: "user@example.com", domainName: "example.com", competitorDomain: "rival.com" },
    expectedCategory: "alert",
  },
  {
    name: "sendBacklinkLostAlert",
    exportName: "sendBacklinkLostAlert",
    args: { to: "user@example.com", domainName: "example.com", lostCount: 15 },
    expectedCategory: "alert",
  },
  {
    name: "sendVisibilityDropAlert",
    exportName: "sendVisibilityDropAlert",
    args: { to: "user@example.com", domainName: "example.com", previousValue: 200, currentValue: 150 },
    expectedCategory: "alert",
  },
  {
    name: "sendTrialReminder",
    exportName: "sendTrialReminder",
    args: { to: "user@example.com", orgName: "TestOrg", daysLeft: 3 },
    expectedCategory: "billing",
  },
  {
    name: "sendPaymentFailedNotice",
    exportName: "sendPaymentFailedNotice",
    args: { to: "user@example.com", orgName: "TestOrg", portalUrl: "https://billing.stripe.com/portal" },
    expectedCategory: "billing",
  },
];

// ---------------------------------------------------------------------------
// Transactional email templates (should NOT have unsubscribe link)
// ---------------------------------------------------------------------------

const TRANSACTIONAL_TEMPLATES: Array<{
  name: string;
  exportName: keyof typeof sendEmail;
  args: Record<string, any>;
}> = [
  {
    name: "sendWelcome",
    exportName: "sendWelcome",
    args: { to: "user@example.com", userName: "Jan" },
  },
  {
    name: "sendPasswordResetCode",
    exportName: "sendPasswordResetCode",
    args: { to: "user@example.com", code: "123456" },
  },
  {
    name: "sendTeamInvitation",
    exportName: "sendTeamInvitation",
    args: { to: "user@example.com", teamName: "Team A", invitedByName: "Admin", token: "tok123" },
  },
  {
    name: "sendSubscriptionConfirmation",
    exportName: "sendSubscriptionConfirmation",
    args: { to: "user@example.com", planName: "Pro", billingCycle: "monthly" },
  },
  {
    name: "sendCancellationConfirmation",
    exportName: "sendCancellationConfirmation",
    args: { to: "user@example.com", orgName: "TestOrg", planName: "Pro" },
  },
  {
    name: "sendDegradationNotice",
    exportName: "sendDegradationNotice",
    args: { to: "user@example.com", orgName: "TestOrg", portalUrl: "https://billing.stripe.com/portal" },
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("R08 Phase 4: Email Hygiene", () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockRunAfter.mockReset();
    // Default: successful send
    mockSend.mockResolvedValue({ data: { id: "email_123" }, error: null });
  });

  // ─── Unsubscribe link presence ──────────────────────────

  describe("Unsubscribe link in non-transactional emails", () => {
    NON_TRANSACTIONAL_TEMPLATES.forEach(({ name, exportName, args }) => {
      it(`${name} contains unsubscribe link`, async () => {
        const ctx = makeCtx();
        const action = sendEmail[exportName] as { handler: Function };
        await action.handler(ctx, args);

        const html = getLastSentHtml();
        expect(html).toMatch(UNSUBSCRIBE_PATTERN);
        expect(html).toMatch(UNSUBSCRIBE_TEXT_PATTERN);
      });
    });
  });

  describe("Unsubscribe link NOT in transactional emails", () => {
    TRANSACTIONAL_TEMPLATES.forEach(({ name, exportName, args }) => {
      it(`${name} does NOT contain unsubscribe link`, async () => {
        const ctx = makeCtx();
        const action = sendEmail[exportName] as { handler: Function };
        await action.handler(ctx, args);

        const html = getLastSentHtml();
        expect(html).not.toMatch(UNSUBSCRIBE_TEXT_PATTERN);
      });
    });
  });

  // ─── Delivery logging (success) ─────────────────────────

  describe("logNotification called on successful send", () => {
    NON_TRANSACTIONAL_TEMPLATES.forEach(({ name, exportName, args, expectedCategory }) => {
      it(`${name} logs with category "${expectedCategory}" on success`, async () => {
        const ctx = makeCtx();
        const action = sendEmail[exportName] as { handler: Function };
        await action.handler(ctx, args);

        expect(mockRunAfter).toHaveBeenCalled();
        // Find the "sent" call (last call should be success since mockSend returns success)
        const sentCall = mockRunAfter.mock.calls.find(
          (call: any[]) => call[2]?.status === "sent"
        );
        expect(sentCall).toBeDefined();
        expect(sentCall![2].category).toBe(expectedCategory);
        expect(sentCall![2].recipient).toBe(args.to);
        expect(sentCall![2].type).toBe("email");
        expect(sentCall![2].metadata?.templateName).toBe(name);
      });
    });

    TRANSACTIONAL_TEMPLATES.forEach(({ name, exportName, args }) => {
      it(`${name} logs with category "transactional" on success`, async () => {
        const ctx = makeCtx();
        const action = sendEmail[exportName] as { handler: Function };
        await action.handler(ctx, args);

        expect(mockRunAfter).toHaveBeenCalled();
        const sentCall = mockRunAfter.mock.calls.find(
          (call: any[]) => call[2]?.status === "sent"
        );
        expect(sentCall).toBeDefined();
        expect(sentCall![2].category).toBe("transactional");
        expect(sentCall![2].metadata?.templateName).toBe(name);
      });
    });
  });

  // ─── Delivery logging (failure) ─────────────────────────

  describe("logNotification called on failed send", () => {
    NON_TRANSACTIONAL_TEMPLATES.forEach(({ name, exportName, args, expectedCategory }) => {
      it(`${name} logs with status "failed" and error on Resend failure`, async () => {
        mockSend.mockResolvedValue({ data: null, error: { message: "Rate limited" } });

        const ctx = makeCtx();
        const action = sendEmail[exportName] as { handler: Function };
        try {
          await action.handler(ctx, args);
        } catch {
          // Some templates throw after logging (e.g. digest templates)
        }

        const failedCall = mockRunAfter.mock.calls.find(
          (call: any[]) => call[2]?.status === "failed"
        );
        expect(failedCall).toBeDefined();
        expect(failedCall![2].status).toBe("failed");
        expect(failedCall![2].error).toBe("Rate limited");
        expect(failedCall![2].category).toBe(expectedCategory);
        expect(failedCall![2].metadata?.templateName).toBe(name);
      });
    });

    it("sendWelcome logs with status failed on error", async () => {
      mockSend.mockResolvedValue({ data: null, error: { message: "Invalid email" } });

      const ctx = makeCtx();
      const action = sendEmail.sendWelcome as { handler: Function };
      await action.handler(ctx, { to: "bad@example.com", userName: "Jan" });

      const failedCall = mockRunAfter.mock.calls.find(
        (call: any[]) => call[2]?.status === "failed"
      );
      expect(failedCall).toBeDefined();
      expect(failedCall![2].status).toBe("failed");
      expect(failedCall![2].error).toBe("Invalid email");
      expect(failedCall![2].category).toBe("transactional");
    });
  });

  // ─── Unsubscribe link URL format ────────────────────────

  it("unsubscribe link points to correct settings URL", async () => {
    const ctx = makeCtx();
    const action = sendEmail.sendDailyDigest as { handler: Function };
    await action.handler(ctx, {
      to: "user@example.com",
      userName: "Jan",
      domainName: "example.com",
      totalKeywords: 50,
      gainers: [],
      losers: [],
    });

    const html = getLastSentHtml();
    expect(html).toContain("https://app.doseo.pl/settings?tab=notifications");
  });

  // ─── logNotification receives correct scheduler reference ─

  it("logNotification is called via scheduler.runAfter with delay 0", async () => {
    const ctx = makeCtx();
    const action = sendEmail.sendDailyDigest as { handler: Function };
    await action.handler(ctx, {
      to: "user@example.com",
      userName: "Jan",
      domainName: "example.com",
      totalKeywords: 50,
      gainers: [],
      losers: [],
    });

    // First arg is delay (0), second is the function reference
    const call = mockRunAfter.mock.calls[0];
    expect(call[0]).toBe(0);
    expect(call[1]).toBe("internal.scheduler.logNotification");
  });
});
