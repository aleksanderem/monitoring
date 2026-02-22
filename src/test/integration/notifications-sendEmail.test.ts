import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock Resend as a class with constructor ──────────────
const mockSend = vi.fn();

vi.mock("resend", () => {
  return {
    Resend: class MockResend {
      emails = { send: mockSend };
    },
  };
});

// ── Mock Convex server (internalAction returns the handler fn) ──
vi.mock("../../../convex/_generated/server", () => ({
  internalAction: ({ handler }: { handler: Function }) => handler,
}));

// ── Import handlers (after mocks) ──
import {
  send,
  sendWelcome,
  sendTeamInvitation,
  sendPasswordResetCode,
  sendSubscriptionConfirmation,
} from "../../../convex/actions/sendEmail";

const FROM_EMAIL = "doseo <noreply@kolabogroup.pl>";
const mockCtx = { scheduler: { runAfter: vi.fn() } } as any;

describe("sendEmail actions", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, RESEND_API_KEY: "re_test_key_123" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ────────────────────────────────────────────────────────
  // send() — generic email
  // ────────────────────────────────────────────────────────
  describe("send()", () => {
    it("calls resend.emails.send with correct from, to, subject, html", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "email_abc" }, error: null });

      await (send as any)(mockCtx, {
        to: "user@example.com",
        subject: "Test Subject",
        html: "<p>Hello</p>",
      });

      expect(mockSend).toHaveBeenCalledOnce();
      expect(mockSend).toHaveBeenCalledWith({
        from: FROM_EMAIL,
        to: "user@example.com",
        subject: "Test Subject",
        html: "<p>Hello</p>",
      });
    });

    it("returns the email ID on success", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "email_xyz" }, error: null });

      const result = await (send as any)(mockCtx, {
        to: "user@example.com",
        subject: "Sub",
        html: "<p>Hi</p>",
      });

      expect(result).toBe("email_xyz");
    });

    it("throws when Resend API returns an error", async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: "Invalid API key" },
      });

      await expect(
        (send as any)(mockCtx, {
          to: "user@example.com",
          subject: "Sub",
          html: "<p>Hi</p>",
        })
      ).rejects.toThrow("Email send failed: Invalid API key");
    });

    it("throws when RESEND_API_KEY is not set", async () => {
      delete process.env.RESEND_API_KEY;

      await expect(
        (send as any)(mockCtx, {
          to: "user@example.com",
          subject: "Sub",
          html: "<p>Hi</p>",
        })
      ).rejects.toThrow("RESEND_API_KEY not configured");
    });

    it("does not call resend.emails.send when API key is missing", async () => {
      delete process.env.RESEND_API_KEY;

      try {
        await (send as any)(mockCtx, {
          to: "user@example.com",
          subject: "Sub",
          html: "<p>Hi</p>",
        });
      } catch {
        // expected
      }

      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────
  // sendWelcome()
  // ────────────────────────────────────────────────────────
  describe("sendWelcome()", () => {
    it("sends email with subject 'Witaj w doseo!'", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "w1" }, error: null });

      await (sendWelcome as any)(mockCtx, {
        to: "new@example.com",
        userName: "Jan",
      });

      expect(mockSend).toHaveBeenCalledOnce();
      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toBe("Witaj w doseo!");
    });

    it("sends from the correct FROM address", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "w2" }, error: null });

      await (sendWelcome as any)(mockCtx, {
        to: "new@example.com",
        userName: "Jan",
      });

      expect(mockSend.mock.calls[0][0].from).toBe(FROM_EMAIL);
    });

    it("HTML contains the userName", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "w3" }, error: null });

      await (sendWelcome as any)(mockCtx, {
        to: "new@example.com",
        userName: "Aleksandra",
      });

      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain("Aleksandra");
    });

    it("HTML contains link to /projects", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "w4" }, error: null });

      await (sendWelcome as any)(mockCtx, {
        to: "new@example.com",
        userName: "Jan",
      });

      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain("/projects");
    });

    it("does NOT throw when Resend API returns an error (graceful)", async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: "Rate limited" },
      });

      // Should not throw — welcome email failures are non-fatal
      await expect(
        (sendWelcome as any)(mockCtx, {
          to: "new@example.com",
          userName: "Jan",
        })
      ).resolves.not.toThrow();
    });

    it("returns undefined (no return value)", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "w5" }, error: null });

      const result = await (sendWelcome as any)(mockCtx, {
        to: "new@example.com",
        userName: "Jan",
      });

      expect(result).toBeUndefined();
    });
  });

  // ────────────────────────────────────────────────────────
  // sendTeamInvitation()
  // ────────────────────────────────────────────────────────
  describe("sendTeamInvitation()", () => {
    const baseArgs = {
      to: "invitee@example.com",
      teamName: "SEO Heroes",
      invitedByName: "Marta",
      token: "tok_abc123",
    };

    it("HTML contains the teamName", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "t1" }, error: null });

      await (sendTeamInvitation as any)(mockCtx, baseArgs);

      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain("SEO Heroes");
    });

    it("HTML contains the invitedByName", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "t2" }, error: null });

      await (sendTeamInvitation as any)(mockCtx, baseArgs);

      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain("Marta");
    });

    it("HTML contains the invite URL with token", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "t3" }, error: null });

      await (sendTeamInvitation as any)(mockCtx, baseArgs);

      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain("/invite?token=tok_abc123");
    });

    it("subject contains the team name", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "t4" }, error: null });

      await (sendTeamInvitation as any)(mockCtx, baseArgs);

      const subject = mockSend.mock.calls[0][0].subject;
      expect(subject).toBe("Zaproszenie do zespołu SEO Heroes — doseo");
    });

    it("includes customMessage block when provided", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "t5" }, error: null });

      await (sendTeamInvitation as any)(mockCtx, {
        ...baseArgs,
        customMessage: "Dołącz do nas!",
      });

      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain("Dołącz do nas!");
    });

    it("customMessage block is absent when not provided", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "t6" }, error: null });

      await (sendTeamInvitation as any)(mockCtx, baseArgs);

      const html = mockSend.mock.calls[0][0].html as string;
      // The customMessage uses a styled quote block with a special opening quote character
      expect(html).not.toContain("\u201E");
    });

    it("does NOT throw on API error (graceful)", async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: "Service unavailable" },
      });

      await expect(
        (sendTeamInvitation as any)(mockCtx, baseArgs)
      ).resolves.not.toThrow();
    });
  });

  // ────────────────────────────────────────────────────────
  // sendPasswordResetCode()
  // ────────────────────────────────────────────────────────
  describe("sendPasswordResetCode()", () => {
    it("HTML contains the verification code", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "p1" }, error: null });

      await (sendPasswordResetCode as any)(mockCtx, {
        to: "user@example.com",
        code: "847291",
      });

      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain("847291");
    });

    it("subject is 'Kod resetowania hasła — doseo'", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "p2" }, error: null });

      await (sendPasswordResetCode as any)(mockCtx, {
        to: "user@example.com",
        code: "123456",
      });

      const subject = mockSend.mock.calls[0][0].subject;
      expect(subject).toBe("Kod resetowania hasła — doseo");
    });

    it("sends from the correct FROM address", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "p3" }, error: null });

      await (sendPasswordResetCode as any)(mockCtx, {
        to: "user@example.com",
        code: "000000",
      });

      expect(mockSend.mock.calls[0][0].from).toBe(FROM_EMAIL);
    });

    it("does NOT throw on API error (graceful)", async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: "Timeout" },
      });

      await expect(
        (sendPasswordResetCode as any)(mockCtx, {
          to: "user@example.com",
          code: "123456",
        })
      ).resolves.not.toThrow();
    });
  });

  // ────────────────────────────────────────────────────────
  // sendSubscriptionConfirmation()
  // ────────────────────────────────────────────────────────
  describe("sendSubscriptionConfirmation()", () => {
    it("HTML contains the planName", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "s1" }, error: null });

      await (sendSubscriptionConfirmation as any)(mockCtx, {
        to: "user@example.com",
        planName: "Pro",
        billingCycle: "monthly",
      });

      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain("Pro");
    });

    it("uses 'roczny' for yearly billing cycle", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "s2" }, error: null });

      await (sendSubscriptionConfirmation as any)(mockCtx, {
        to: "user@example.com",
        planName: "Business",
        billingCycle: "yearly",
      });

      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain("roczny");
      expect(html).not.toContain("miesięczny");
    });

    it("uses 'miesięczny' for monthly billing cycle", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "s3" }, error: null });

      await (sendSubscriptionConfirmation as any)(mockCtx, {
        to: "user@example.com",
        planName: "Starter",
        billingCycle: "monthly",
      });

      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain("miesięczny");
      expect(html).not.toContain("roczny");
    });

    it("HTML contains link to /settings", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "s4" }, error: null });

      await (sendSubscriptionConfirmation as any)(mockCtx, {
        to: "user@example.com",
        planName: "Pro",
        billingCycle: "monthly",
      });

      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain("/settings");
    });

    it("subject contains the plan name", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "s5" }, error: null });

      await (sendSubscriptionConfirmation as any)(mockCtx, {
        to: "user@example.com",
        planName: "Enterprise",
        billingCycle: "yearly",
      });

      const subject = mockSend.mock.calls[0][0].subject;
      expect(subject).toBe("Plan Enterprise aktywowany — doseo");
    });

    it("does NOT throw on API error (graceful)", async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: "Bad request" },
      });

      await expect(
        (sendSubscriptionConfirmation as any)(mockCtx, {
          to: "user@example.com",
          planName: "Pro",
          billingCycle: "monthly",
        })
      ).resolves.not.toThrow();
    });
  });
});
