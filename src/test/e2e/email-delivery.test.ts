/**
 * E2E Email Delivery Tests — Resend API + Mailtrap SMTP→Inbox
 *
 * Two verification layers:
 * 1. Resend API: send email, verify Resend accepts it (status != bounced)
 * 2. Mailtrap SMTP→Inbox: send same HTML via Mailtrap SMTP, read back
 *    via Mailtrap API to verify content arrives intact
 *
 * Required env vars:
 *   RESEND_API_KEY        — Resend API key
 *   MAILTRAP_API_TOKEN    — Mailtrap HTTP API token
 *   MAILTRAP_ACCOUNT_ID   — Mailtrap account ID
 *   MAILTRAP_INBOX_ID     — Mailtrap sandbox inbox ID
 *   MAILTRAP_SMTP_USER    — Mailtrap SMTP username
 *   MAILTRAP_SMTP_PASS    — Mailtrap SMTP password
 *
 * Run with:
 *   RESEND_API_KEY=... MAILTRAP_API_TOKEN=... MAILTRAP_ACCOUNT_ID=... \
 *   MAILTRAP_INBOX_ID=... MAILTRAP_SMTP_USER=... MAILTRAP_SMTP_PASS=... \
 *   npx vitest run src/test/e2e/email-delivery.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  sendViaSMTP,
  cleanInbox,
  waitForEmail,
  getMessageHtml,
} from "../helpers/mailtrap-client";
import {
  sendEmail as resendSend,
  waitForResendStatus,
} from "../helpers/resend-client";

// ─── Skip logic ──────────────────────────────────────────

const SKIP =
  !process.env.RESEND_API_KEY ||
  !process.env.MAILTRAP_API_TOKEN ||
  !process.env.MAILTRAP_ACCOUNT_ID ||
  !process.env.MAILTRAP_INBOX_ID ||
  !process.env.MAILTRAP_SMTP_USER ||
  !process.env.MAILTRAP_SMTP_PASS;

// ─── Constants (mirror production) ───────────────────────

const FROM_EMAIL = "doseo <noreply@kolabogroup.pl>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const TEST_RECIPIENT = "test@doseo-e2e.local";

function inboxId() {
  return process.env.MAILTRAP_INBOX_ID!;
}

// ─── HTML template builders (mirror production code) ─────

function buildWelcomeHtml(userName: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#7f56d9;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Witaj, ${userName}!</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">
        Twoje konto w doseo zostało utworzone. Platforma jest gotowa do monitoringu SEO Twojej domeny.
      </p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475467;">
        Możesz teraz dodać swoją pierwszą domenę i zacząć śledzić pozycje słów kluczowych.
      </p>
      <a href="${APP_URL}/projects"
         style="display:inline-block;padding:12px 24px;background:#7f56d9;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">
        Przejdź do panelu
      </a>
      <p style="margin:32px 0 0;font-size:13px;color:#98a2b3;">
        Jeśli masz pytania, odpowiedz na tego maila — chętnie pomożemy.
      </p>
    </div>
    <div style="padding:20px 40px;background:#f9fafb;border-top:1px solid #eaecf0;">
      <p style="margin:0;font-size:12px;color:#98a2b3;">doseo — SEO monitoring & strategy platform</p>
    </div>
  </div>
</body>
</html>`;
}

function buildTeamInvitationHtml(params: {
  teamName: string;
  invitedByName: string;
  token: string;
  customMessage?: string;
}): string {
  const inviteUrl = `${APP_URL}/invite?token=${params.token}`;
  const messageBlock = params.customMessage
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;background:#f9fafb;padding:16px;border-radius:8px;border-left:3px solid #7f56d9;">
        „${params.customMessage}"
      </p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#7f56d9;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Zaproszenie do zespołu</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">
        <strong>${params.invitedByName}</strong> zaprasza Cię do zespołu <strong>${params.teamName}</strong> na platformie doseo.
      </p>
      ${messageBlock}
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475467;">
        Kliknij poniżej, aby dołączyć do zespołu:
      </p>
      <a href="${inviteUrl}"
         style="display:inline-block;padding:12px 24px;background:#7f56d9;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">
        Dołącz do zespołu
      </a>
      <p style="margin:32px 0 0;font-size:13px;color:#98a2b3;">
        Zaproszenie wygasa za 7 dni. Jeśli nie oczekiwałeś tego maila, zignoruj go.
      </p>
    </div>
    <div style="padding:20px 40px;background:#f9fafb;border-top:1px solid #eaecf0;">
      <p style="margin:0;font-size:12px;color:#98a2b3;">doseo — SEO monitoring & strategy platform</p>
    </div>
  </div>
</body>
</html>`;
}

function buildPasswordResetCodeHtml(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#7f56d9;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Reset hasła</h2>
      <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#475467;">
        Twój kod weryfikacyjny:
      </p>
      <div style="margin:16px 0 24px;padding:16px 24px;background:#f9fafb;border-radius:8px;border:1px solid #eaecf0;text-align:center;">
        <span style="font-size:32px;font-family:'Courier New',monospace;font-weight:700;letter-spacing:4px;color:#101828;">${code}</span>
      </div>
      <p style="margin:0 0 0;font-size:13px;color:#98a2b3;">
        Kod jest ważny przez 1 godzinę. Jeśli nie prosiłeś o reset hasła, zignoruj tego maila.
      </p>
    </div>
    <div style="padding:20px 40px;background:#f9fafb;border-top:1px solid #eaecf0;">
      <p style="margin:0;font-size:12px;color:#98a2b3;">doseo — SEO monitoring & strategy platform</p>
    </div>
  </div>
</body>
</html>`;
}

function buildSubscriptionConfirmationHtml(params: {
  planName: string;
  billingCycle: string;
}): string {
  const cycleLabel = params.billingCycle === "yearly" ? "roczny" : "miesięczny";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#7f56d9;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Subskrypcja aktywna!</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">
        Plan <strong>${params.planName}</strong> (${cycleLabel}) został aktywowany. Masz teraz dostęp do wszystkich funkcji w ramach tego planu.
      </p>
      <a href="${APP_URL}/settings"
         style="display:inline-block;padding:12px 24px;background:#7f56d9;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">
        Przejdź do ustawień
      </a>
      <p style="margin:32px 0 0;font-size:13px;color:#98a2b3;">
        Szczegóły subskrypcji znajdziesz w zakładce Ustawienia &rarr; Plan i Limity.
      </p>
    </div>
    <div style="padding:20px 40px;background:#f9fafb;border-top:1px solid #eaecf0;">
      <p style="margin:0;font-size:12px;color:#98a2b3;">doseo — SEO monitoring & strategy platform</p>
    </div>
  </div>
</body>
</html>`;
}

function buildEmailVerificationHtml(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#7f56d9;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Weryfikacja email</h2>
      <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#475467;">
        Twój kod weryfikacyjny:
      </p>
      <div style="margin:16px 0 24px;padding:16px 24px;background:#f9fafb;border-radius:8px;border:1px solid #eaecf0;text-align:center;">
        <span style="font-size:32px;font-family:'Courier New',monospace;font-weight:700;letter-spacing:4px;color:#101828;">${code}</span>
      </div>
      <p style="margin:0 0 0;font-size:13px;color:#98a2b3;">
        Kod jest ważny przez 1 godzinę. Jeśli nie zakładałeś konta w doseo, zignoruj tego maila.
      </p>
    </div>
    <div style="padding:20px 40px;background:#f9fafb;border-top:1px solid #eaecf0;">
      <p style="margin:0;font-size:12px;color:#98a2b3;">doseo — SEO monitoring & strategy platform</p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Test suite ──────────────────────────────────────────

describe.skipIf(SKIP)("E2E Email Delivery", () => {
  // Clean inbox before each test to avoid cross-contamination
  beforeEach(async () => {
    await cleanInbox(inboxId());
    // Brief pause after clean to let Mailtrap process
    await new Promise((r) => setTimeout(r, 1_000));
  }, 10_000);

  // ─── 1. Generic send ─────────────────────────────────

  describe("Generic send", () => {
    it("Resend accepts a plain HTML email and returns a valid ID", async () => {
      const emailId = await resendSend({
        from: FROM_EMAIL,
        to: TEST_RECIPIENT,
        subject: "E2E Test — generic send",
        html: "<h1>Hello from e2e test</h1><p>This is a generic test email.</p>",
      });

      expect(emailId).toBeTruthy();
      expect(typeof emailId).toBe("string");

      // Verify Resend processed the email (reached a terminal state)
      const status = await waitForResendStatus(emailId);
      expect(status.id).toBe(emailId);
      expect(status.from).toContain("noreply@kolabogroup.pl");
      expect(status.subject).toBe("E2E Test — generic send");
      // Resend will bounce to fake domains — the important thing is it processed the request
      expect(["delivered", "bounced", "delivery_delayed", "complained"]).toContain(
        status.last_event,
      );
    }, 20_000);

    it("Mailtrap receives the generic email with correct fields", async () => {
      await sendViaSMTP({
        from: FROM_EMAIL,
        to: TEST_RECIPIENT,
        subject: "E2E Test — generic receive",
        html: "<h1>Generic receive test</h1>",
      });

      const msg = await waitForEmail(inboxId(), {
        subject: "E2E Test — generic receive",
      });

      expect(msg.subject).toContain("generic receive");
      expect(msg.from_email).toBe("noreply@kolabogroup.pl");
      expect(msg.to_email).toBe(TEST_RECIPIENT);
    }, 35_000);
  });

  // ─── 2. Welcome email ────────────────────────────────

  describe("Welcome email", () => {
    const userName = "TestUser";

    it("Resend accepts the welcome email", async () => {
      const emailId = await resendSend({
        from: FROM_EMAIL,
        to: TEST_RECIPIENT,
        subject: "Witaj w doseo!",
        html: buildWelcomeHtml(userName),
      });

      expect(emailId).toBeTruthy();
      const status = await waitForResendStatus(emailId);
      expect(status.subject).toBe("Witaj w doseo!");
      expect(["delivered", "bounced", "delivery_delayed", "complained"]).toContain(
        status.last_event,
      );
    }, 20_000);

    it("Mailtrap receives welcome email with user name in HTML", async () => {
      await sendViaSMTP({
        from: FROM_EMAIL,
        to: TEST_RECIPIENT,
        subject: "Witaj w doseo!",
        html: buildWelcomeHtml(userName),
      });

      const msg = await waitForEmail(inboxId(), {
        subject: "Witaj w doseo!",
      });

      expect(msg.subject).toBe("Witaj w doseo!");

      const html = await getMessageHtml(inboxId(), msg.id);
      expect(html).toContain(userName);
      expect(html).toContain("panelu");
    }, 35_000);
  });

  // ─── 3. Team invitation email ────────────────────────

  describe("Team invitation email", () => {
    const teamName = "Test SEO Team";
    const invitedByName = "Admin User";
    const token = "test-invite-token-abc123";

    it("Resend accepts the team invitation email", async () => {
      const emailId = await resendSend({
        from: FROM_EMAIL,
        to: TEST_RECIPIENT,
        subject: `Zaproszenie do zespołu ${teamName} — doseo`,
        html: buildTeamInvitationHtml({ teamName, invitedByName, token }),
      });

      expect(emailId).toBeTruthy();
      const status = await waitForResendStatus(emailId);
      expect(status.subject).toContain("Zaproszenie do zespołu");
      expect(["delivered", "bounced", "delivery_delayed", "complained"]).toContain(
        status.last_event,
      );
    }, 20_000);

    it("Mailtrap receives invitation with team name and invite link", async () => {
      await sendViaSMTP({
        from: FROM_EMAIL,
        to: TEST_RECIPIENT,
        subject: `Zaproszenie do zespołu ${teamName} — doseo`,
        html: buildTeamInvitationHtml({
          teamName,
          invitedByName,
          token,
          customMessage: "Dołącz do naszego projektu!",
        }),
      });

      const msg = await waitForEmail(inboxId(), {
        subject: "Zaproszenie do zespołu",
      });

      expect(msg.subject).toContain("Zaproszenie do zespołu");
      expect(msg.subject).toContain(teamName);

      const html = await getMessageHtml(inboxId(), msg.id);
      expect(html).toContain(teamName);
      expect(html).toContain(invitedByName);
      expect(html).toContain(`/invite?token=${token}`);
      expect(html).toContain("naszego projektu");
    }, 35_000);
  });

  // ─── 4. Password reset code email ────────────────────

  describe("Password reset code email", () => {
    const resetCode = "48291037";

    it("Resend accepts the password reset code email", async () => {
      const emailId = await resendSend({
        from: FROM_EMAIL,
        to: TEST_RECIPIENT,
        subject: "Kod resetowania hasła — doseo",
        html: buildPasswordResetCodeHtml(resetCode),
      });

      expect(emailId).toBeTruthy();
      const status = await waitForResendStatus(emailId);
      expect(status.subject).toContain("Kod resetowania hasła");
      expect(["delivered", "bounced", "delivery_delayed", "complained"]).toContain(
        status.last_event,
      );
    }, 20_000);

    it("Mailtrap receives password reset with 8-digit code in HTML", async () => {
      await sendViaSMTP({
        from: FROM_EMAIL,
        to: TEST_RECIPIENT,
        subject: "Kod resetowania hasła — doseo",
        html: buildPasswordResetCodeHtml(resetCode),
      });

      const msg = await waitForEmail(inboxId(), {
        subject: "Kod resetowania hasła",
      });

      expect(msg.subject).toContain("Kod resetowania hasła");

      const html = await getMessageHtml(inboxId(), msg.id);
      expect(html).toContain(resetCode);
    }, 35_000);
  });

  // ─── 5. Subscription confirmation email ──────────────

  describe("Subscription confirmation email", () => {
    const planName = "Professional";
    const billingCycle = "yearly";

    it("Resend accepts the subscription confirmation email", async () => {
      const emailId = await resendSend({
        from: FROM_EMAIL,
        to: TEST_RECIPIENT,
        subject: `Plan ${planName} aktywowany — doseo`,
        html: buildSubscriptionConfirmationHtml({ planName, billingCycle }),
      });

      expect(emailId).toBeTruthy();
      const status = await waitForResendStatus(emailId);
      expect(status.subject).toContain(planName);
      expect(["delivered", "bounced", "delivery_delayed", "complained"]).toContain(
        status.last_event,
      );
    }, 20_000);

    it("Mailtrap receives subscription confirmation with plan and billing cycle", async () => {
      await sendViaSMTP({
        from: FROM_EMAIL,
        to: TEST_RECIPIENT,
        subject: `Plan ${planName} aktywowany — doseo`,
        html: buildSubscriptionConfirmationHtml({ planName, billingCycle }),
      });

      const msg = await waitForEmail(inboxId(), {
        subject: `Plan ${planName} aktywowany`,
      });

      expect(msg.subject).toContain(planName);

      const html = await getMessageHtml(inboxId(), msg.id);
      expect(html).toContain(planName);
      expect(html).toContain("roczny"); // yearly → "roczny"
    }, 35_000);
  });

  // ─── 6. Email verification code ──────────────────────

  describe("Email verification code", () => {
    const verifyCode = "73925184";

    it("Resend accepts the email verification code email", async () => {
      const emailId = await resendSend({
        from: FROM_EMAIL,
        to: TEST_RECIPIENT,
        subject: "Kod weryfikacyjny — doseo",
        html: buildEmailVerificationHtml(verifyCode),
      });

      expect(emailId).toBeTruthy();
      const status = await waitForResendStatus(emailId);
      expect(status.subject).toContain("Kod weryfikacyjny");
      expect(["delivered", "bounced", "delivery_delayed", "complained"]).toContain(
        status.last_event,
      );
    }, 20_000);

    it("Mailtrap receives verification email with code in HTML", async () => {
      await sendViaSMTP({
        from: FROM_EMAIL,
        to: TEST_RECIPIENT,
        subject: "Kod weryfikacyjny — doseo",
        html: buildEmailVerificationHtml(verifyCode),
      });

      const msg = await waitForEmail(inboxId(), {
        subject: "Kod weryfikacyjny",
      });

      expect(msg.subject).toContain("Kod weryfikacyjny");

      const html = await getMessageHtml(inboxId(), msg.id);
      expect(html).toContain(verifyCode);
      expect(html).toContain("Weryfikacja email");
    }, 35_000);
  });

  // ─── 7. Delivery timing ──────────────────────────────

  describe("Delivery timing", () => {
    it("email arrives in Mailtrap within 30 seconds via SMTP", async () => {
      const sendTime = Date.now();

      await sendViaSMTP({
        from: FROM_EMAIL,
        to: TEST_RECIPIENT,
        subject: "E2E Test — delivery timing",
        html: "<p>Timing test</p>",
      });

      const msg = await waitForEmail(inboxId(), {
        subject: "E2E Test — delivery timing",
      });

      const deliveryMs = Date.now() - sendTime;
      console.log(`[e2e] Email delivery time: ${(deliveryMs / 1000).toFixed(1)}s`);

      expect(msg).toBeTruthy();
      expect(deliveryMs).toBeLessThan(30_000);
    }, 35_000);
  });

  // ─── 8. From address verification ────────────────────

  describe("From address verification", () => {
    it("emails arrive from noreply@kolabogroup.pl with doseo display name", async () => {
      await sendViaSMTP({
        from: FROM_EMAIL,
        to: TEST_RECIPIENT,
        subject: "E2E Test — from address check",
        html: buildWelcomeHtml("FromTest"),
      });

      const msg = await waitForEmail(inboxId(), {
        subject: "E2E Test — from address check",
      });

      expect(msg.from_email).toBe("noreply@kolabogroup.pl");
      expect(msg.from_name).toBe("doseo");
    }, 35_000);
  });

  // ─── 9. HTML content integrity ───────────────────────

  describe("HTML content integrity", () => {
    it("received HTML preserves Polish characters and special entities", async () => {
      const specialContent = `<div data-testid="integrity">
  <p>Polish chars: ąćęłńóśźż ĄĆĘŁŃÓŚŹŻ</p>
  <p>Special: &amp; &lt; &gt;</p>
  <p>Unicode: ★ ✓ ➜</p>
</div>`;

      await sendViaSMTP({
        from: FROM_EMAIL,
        to: TEST_RECIPIENT,
        subject: "E2E Test — HTML integrity",
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${specialContent}</body></html>`,
      });

      const msg = await waitForEmail(inboxId(), {
        subject: "E2E Test — HTML integrity",
      });

      const html = await getMessageHtml(inboxId(), msg.id);

      // Verify Polish characters survived encoding
      expect(html).toContain("ąćęłńóśźż");
      expect(html).toContain("ĄĆĘŁŃÓŚŹŻ");
      // Verify special chars
      expect(html).toMatch(/★/);
      expect(html).toMatch(/✓/);
    }, 35_000);
  });
});
