/**
 * Real Email Delivery Test — sends all email templates via Resend API
 * to a real inbox for manual verification.
 *
 * Uses the production FROM address: doseo <noreply@kolabogroup.pl>
 * (sending domain: mail.kolabogroup.pl configured in Resend)
 *
 * Run with:
 *   npx vitest run src/test/e2e/real-email-delivery.test.ts
 *
 * Requires: RESEND_API_KEY in .env.local
 */

import { describe, it, expect } from "vitest";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SKIP = !RESEND_API_KEY;

const FROM_EMAIL = "doseo <noreply@kolabogroup.pl>";
const TO_EMAIL = "aleksander@kolaboit.pl";
const APP_URL = "https://app.doseo.io";

async function sendViaResend(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ id: string; status: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }

  const data = await res.json();

  // Wait a moment then check status
  await new Promise((r) => setTimeout(r, 2000));

  const statusRes = await fetch(`https://api.resend.com/emails/${data.id}`, {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
  });
  const status = await statusRes.json();

  return { id: data.id, status: status.last_event };
}

// ─── HTML builders (mirror production sendEmail.ts) ─────

function buildWelcomeHtml(userName: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#7f56d9;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Witaj, ${userName}!</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">Twoje konto w doseo zostało utworzone. Platforma jest gotowa do monitoringu SEO Twojej domeny.</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475467;">Możesz teraz dodać swoją pierwszą domenę i zacząć śledzić pozycje słów kluczowych.</p>
      <a href="${APP_URL}/projects" style="display:inline-block;padding:12px 24px;background:#7f56d9;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">Przejdź do panelu</a>
      <p style="margin:32px 0 0;font-size:13px;color:#98a2b3;">Jeśli masz pytania, odpowiedz na tego maila — chętnie pomożemy.</p>
    </div>
    <div style="padding:20px 40px;background:#f9fafb;border-top:1px solid #eaecf0;">
      <p style="margin:0;font-size:12px;color:#98a2b3;">doseo — SEO monitoring & strategy platform</p>
    </div>
  </div>
</body></html>`;
}

function buildTeamInvitationHtml(teamName: string, invitedByName: string, token: string): string {
  const inviteUrl = `${APP_URL}/invite?token=${token}`;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#7f56d9;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Zaproszenie do zespołu</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;"><strong>${invitedByName}</strong> zaprasza Cię do zespołu <strong>${teamName}</strong> na platformie doseo.</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475467;">Kliknij poniżej, aby dołączyć do zespołu:</p>
      <a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#7f56d9;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">Dołącz do zespołu</a>
      <p style="margin:32px 0 0;font-size:13px;color:#98a2b3;">Zaproszenie wygasa za 7 dni. Jeśli nie oczekiwałeś tego maila, zignoruj go.</p>
    </div>
    <div style="padding:20px 40px;background:#f9fafb;border-top:1px solid #eaecf0;">
      <p style="margin:0;font-size:12px;color:#98a2b3;">doseo — SEO monitoring & strategy platform</p>
    </div>
  </div>
</body></html>`;
}

function buildPasswordResetCodeHtml(code: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#7f56d9;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Reset hasła</h2>
      <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#475467;">Twój kod weryfikacyjny:</p>
      <div style="margin:16px 0 24px;padding:16px 24px;background:#f9fafb;border-radius:8px;border:1px solid #eaecf0;text-align:center;">
        <span style="font-size:32px;font-family:'Courier New',monospace;font-weight:700;letter-spacing:4px;color:#101828;">${code}</span>
      </div>
      <p style="margin:0 0 0;font-size:13px;color:#98a2b3;">Kod jest ważny przez 1 godzinę. Jeśli nie prosiłeś o reset hasła, zignoruj tego maila.</p>
    </div>
    <div style="padding:20px 40px;background:#f9fafb;border-top:1px solid #eaecf0;">
      <p style="margin:0;font-size:12px;color:#98a2b3;">doseo — SEO monitoring & strategy platform</p>
    </div>
  </div>
</body></html>`;
}

function buildEmailVerificationHtml(code: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#7f56d9;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Weryfikacja email</h2>
      <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#475467;">Twój kod weryfikacyjny:</p>
      <div style="margin:16px 0 24px;padding:16px 24px;background:#f9fafb;border-radius:8px;border:1px solid #eaecf0;text-align:center;">
        <span style="font-size:32px;font-family:'Courier New',monospace;font-weight:700;letter-spacing:4px;color:#101828;">${code}</span>
      </div>
      <p style="margin:0 0 0;font-size:13px;color:#98a2b3;">Kod jest ważny przez 1 godzinę. Jeśli nie zakładałeś konta w doseo, zignoruj tego maila.</p>
    </div>
    <div style="padding:20px 40px;background:#f9fafb;border-top:1px solid #eaecf0;">
      <p style="margin:0;font-size:12px;color:#98a2b3;">doseo — SEO monitoring & strategy platform</p>
    </div>
  </div>
</body></html>`;
}

function buildSubscriptionConfirmationHtml(planName: string, billingCycle: string): string {
  const cycleLabel = billingCycle === "yearly" ? "roczny" : "miesięczny";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#7f56d9;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Subskrypcja aktywna!</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">Plan <strong>${planName}</strong> (${cycleLabel}) został aktywowany. Masz teraz dostęp do wszystkich funkcji w ramach tego planu.</p>
      <a href="${APP_URL}/settings" style="display:inline-block;padding:12px 24px;background:#7f56d9;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">Przejdź do ustawień</a>
      <p style="margin:32px 0 0;font-size:13px;color:#98a2b3;">Szczegóły subskrypcji znajdziesz w zakładce Ustawienia &rarr; Plan i Limity.</p>
    </div>
    <div style="padding:20px 40px;background:#f9fafb;border-top:1px solid #eaecf0;">
      <p style="margin:0;font-size:12px;color:#98a2b3;">doseo — SEO monitoring & strategy platform</p>
    </div>
  </div>
</body></html>`;
}

function buildPaymentFailedHtml(orgName: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#dc2626;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Płatność nie powiodła się</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">Nie udało się pobrać płatności za subskrypcję organizacji <strong>${orgName}</strong>.</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">Masz <strong>7 dni</strong> na zaktualizowanie metody płatności. Po tym czasie Twoje konto zostanie przełączone w tryb tylko do odczytu.</p>
      <a href="${APP_URL}/settings?tab=plan" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">Zaktualizuj metodę płatności</a>
      <p style="margin:32px 0 0;font-size:13px;color:#98a2b3;">Jeśli masz pytania, odpowiedz na tego maila.</p>
    </div>
    <div style="padding:20px 40px;background:#f9fafb;border-top:1px solid #eaecf0;">
      <p style="margin:0;font-size:12px;color:#98a2b3;">doseo — SEO monitoring & strategy platform</p>
    </div>
  </div>
</body></html>`;
}

function buildTrialReminderHtml(orgName: string, daysLeft: number): string {
  const daysLabel = daysLeft === 1 ? "1 dzień" : `${daysLeft} dni`;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#7f56d9;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Trial kończy się za ${daysLabel}</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">Twój okres próbny planu Pro dla organizacji <strong>${orgName}</strong> kończy się za <strong>${daysLabel}</strong>.</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475467;">Aby zachować dostęp do wszystkich funkcji Pro, upewnij się że masz dodaną metodę płatności.</p>
      <a href="${APP_URL}/settings?tab=plan" style="display:inline-block;padding:12px 24px;background:#7f56d9;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">Zarządzaj subskrypcją</a>
      <p style="margin:32px 0 0;font-size:13px;color:#98a2b3;">Jeśli masz pytania dotyczące planu, odpowiedz na tego maila.</p>
    </div>
    <div style="padding:20px 40px;background:#f9fafb;border-top:1px solid #eaecf0;">
      <p style="margin:0;font-size:12px;color:#98a2b3;">doseo — SEO monitoring & strategy platform</p>
    </div>
  </div>
</body></html>`;
}

function buildCancellationHtml(orgName: string, planName: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#7f56d9;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Subskrypcja anulowana</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">Plan <strong>${planName}</strong> dla organizacji <strong>${orgName}</strong> został anulowany.</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">Twoje konto zostało przełączone na plan Free. Wszystkie Twoje dane zostały zachowane.</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475467;">Możesz w każdej chwili ponownie aktywować subskrypcję:</p>
      <a href="${APP_URL}/pricing" style="display:inline-block;padding:12px 24px;background:#7f56d9;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">Ponownie aktywuj plan</a>
      <p style="margin:32px 0 0;font-size:13px;color:#98a2b3;">Dziękujemy za korzystanie z doseo.</p>
    </div>
    <div style="padding:20px 40px;background:#f9fafb;border-top:1px solid #eaecf0;">
      <p style="margin:0;font-size:12px;color:#98a2b3;">doseo — SEO monitoring & strategy platform</p>
    </div>
  </div>
</body></html>`;
}

function buildDegradationHtml(orgName: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#dc2626;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Konto w trybie tylko do odczytu</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">Okres karencji dla organizacji <strong>${orgName}</strong> minął, a płatność nadal nie została pobrana.</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475467;">Twoje konto zostało przełączone w tryb tylko do odczytu. Aby przywrócić pełny dostęp, zaktualizuj metodę płatności:</p>
      <a href="${APP_URL}/settings?tab=plan" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">Zaktualizuj metodę płatności</a>
      <p style="margin:32px 0 0;font-size:13px;color:#98a2b3;">Twoje dane nie zostały usunięte. Po uregulowaniu płatności wszystko wróci do normy.</p>
    </div>
    <div style="padding:20px 40px;background:#f9fafb;border-top:1px solid #eaecf0;">
      <p style="margin:0;font-size:12px;color:#98a2b3;">doseo — SEO monitoring & strategy platform</p>
    </div>
  </div>
</body></html>`;
}

// ─── Test suite ──────────────────────────────────────────

describe.skipIf(SKIP)("Real Email Delivery to aleksander@kolaboit.pl", () => {
  const results: { template: string; id: string; status: string }[] = [];

  it("1. Welcome email", async () => {
    const r = await sendViaResend({
      to: TO_EMAIL,
      subject: "[TEST] Witaj w doseo! — welcome email",
      html: buildWelcomeHtml("Aleksander"),
    });
    results.push({ template: "welcome", ...r });
    expect(r.id).toBeTruthy();
    console.log(`  ✓ welcome: id=${r.id} status=${r.status}`);
  }, 15_000);

  it("2. Email verification code", async () => {
    const r = await sendViaResend({
      to: TO_EMAIL,
      subject: "[TEST] Kod weryfikacyjny — doseo",
      html: buildEmailVerificationHtml("73925184"),
    });
    results.push({ template: "email-verification", ...r });
    expect(r.id).toBeTruthy();
    console.log(`  ✓ email-verification: id=${r.id} status=${r.status}`);
  }, 15_000);

  it("3. Password reset code", async () => {
    const r = await sendViaResend({
      to: TO_EMAIL,
      subject: "[TEST] Kod resetowania hasła — doseo",
      html: buildPasswordResetCodeHtml("48291037"),
    });
    results.push({ template: "password-reset", ...r });
    expect(r.id).toBeTruthy();
    console.log(`  ✓ password-reset: id=${r.id} status=${r.status}`);
  }, 15_000);

  it("4. Team invitation", async () => {
    const r = await sendViaResend({
      to: TO_EMAIL,
      subject: "[TEST] Zaproszenie do zespołu SEO Agency Team — doseo",
      html: buildTeamInvitationHtml("SEO Agency Team", "Admin User", "test-token-abc123"),
    });
    results.push({ template: "team-invitation", ...r });
    expect(r.id).toBeTruthy();
    console.log(`  ✓ team-invitation: id=${r.id} status=${r.status}`);
  }, 15_000);

  it("5. Subscription confirmation", async () => {
    const r = await sendViaResend({
      to: TO_EMAIL,
      subject: "[TEST] Plan Professional aktywowany — doseo",
      html: buildSubscriptionConfirmationHtml("Professional", "yearly"),
    });
    results.push({ template: "subscription-confirmation", ...r });
    expect(r.id).toBeTruthy();
    console.log(`  ✓ subscription-confirmation: id=${r.id} status=${r.status}`);
  }, 15_000);

  it("6. Payment failed notice", async () => {
    const r = await sendViaResend({
      to: TO_EMAIL,
      subject: "[TEST] Płatność nie powiodła się — doseo",
      html: buildPaymentFailedHtml("Kolabo Group"),
    });
    results.push({ template: "payment-failed", ...r });
    expect(r.id).toBeTruthy();
    console.log(`  ✓ payment-failed: id=${r.id} status=${r.status}`);
  }, 15_000);

  it("7. Trial reminder (3 days)", async () => {
    const r = await sendViaResend({
      to: TO_EMAIL,
      subject: "[TEST] Trial kończy się za 3 dni — doseo",
      html: buildTrialReminderHtml("Kolabo Group", 3),
    });
    results.push({ template: "trial-reminder-3d", ...r });
    expect(r.id).toBeTruthy();
    console.log(`  ✓ trial-reminder-3d: id=${r.id} status=${r.status}`);
  }, 15_000);

  it("8. Trial reminder (1 day)", async () => {
    const r = await sendViaResend({
      to: TO_EMAIL,
      subject: "[TEST] Trial kończy się za 1 dzień — doseo",
      html: buildTrialReminderHtml("Kolabo Group", 1),
    });
    results.push({ template: "trial-reminder-1d", ...r });
    expect(r.id).toBeTruthy();
    console.log(`  ✓ trial-reminder-1d: id=${r.id} status=${r.status}`);
  }, 15_000);

  it("9. Cancellation confirmation", async () => {
    const r = await sendViaResend({
      to: TO_EMAIL,
      subject: "[TEST] Subskrypcja anulowana — doseo",
      html: buildCancellationHtml("Kolabo Group", "Professional"),
    });
    results.push({ template: "cancellation", ...r });
    expect(r.id).toBeTruthy();
    console.log(`  ✓ cancellation: id=${r.id} status=${r.status}`);
  }, 15_000);

  it("10. Degradation notice (read-only mode)", async () => {
    const r = await sendViaResend({
      to: TO_EMAIL,
      subject: "[TEST] Konto w trybie tylko do odczytu — doseo",
      html: buildDegradationHtml("Kolabo Group"),
    });
    results.push({ template: "degradation", ...r });
    expect(r.id).toBeTruthy();
    console.log(`  ✓ degradation: id=${r.id} status=${r.status}`);
  }, 15_000);

  it("Summary: all 10 templates sent successfully", () => {
    console.log("\n=== Email Delivery Summary ===");
    console.log(`To: ${TO_EMAIL}`);
    console.log(`From: ${FROM_EMAIL}`);
    console.log(`Templates sent: ${results.length}/10`);
    for (const r of results) {
      console.log(`  ${r.template}: ${r.status} (${r.id})`);
    }
    expect(results.length).toBe(10);
    expect(results.every((r) => r.id)).toBe(true);
  });
});
