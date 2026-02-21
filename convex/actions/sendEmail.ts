"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { Resend } from "resend";

const FROM_EMAIL = "doseo <noreply@kolabogroup.pl>";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not configured");
  return new Resend(key);
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

// ─── Generic send ────────────────────────────────────────

export const send = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: args.to,
      subject: args.subject,
      html: args.html,
    });
    if (error) {
      console.error("[email] Send failed:", error);
      throw new Error(`Email send failed: ${error.message}`);
    }
    console.log("[email] Sent to", args.to, "id:", data?.id);
    return data?.id;
  },
});

// ─── Welcome email ───────────────────────────────────────

export const sendWelcome = internalAction({
  args: {
    to: v.string(),
    userName: v.string(),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();
    const appUrl = getAppUrl();

    const html = `
<!DOCTYPE html>
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
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Witaj, ${args.userName}!</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">
        Twoje konto w doseo zostało utworzone. Platforma jest gotowa do monitoringu SEO Twojej domeny.
      </p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475467;">
        Możesz teraz dodać swoją pierwszą domenę i zacząć śledzić pozycje słów kluczowych.
      </p>
      <a href="${appUrl}/projects"
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

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: args.to,
      subject: "Witaj w doseo!",
      html,
    });
    if (error) {
      console.error("[email] Welcome email failed:", error);
      return;
    }
    console.log("[email] Welcome sent to", args.to, "id:", data?.id);
  },
});

// ─── Team invitation email ───────────────────────────────

export const sendTeamInvitation = internalAction({
  args: {
    to: v.string(),
    teamName: v.string(),
    invitedByName: v.string(),
    token: v.string(),
    customMessage: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();
    const appUrl = getAppUrl();
    const inviteUrl = `${appUrl}/invite?token=${args.token}`;

    const messageBlock = args.customMessage
      ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;background:#f9fafb;padding:16px;border-radius:8px;border-left:3px solid #7f56d9;">
          „${args.customMessage}"
        </p>`
      : "";

    const html = `
<!DOCTYPE html>
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
        <strong>${args.invitedByName}</strong> zaprasza Cię do zespołu <strong>${args.teamName}</strong> na platformie doseo.
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

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: args.to,
      subject: `Zaproszenie do zespołu ${args.teamName} — doseo`,
      html,
    });
    if (error) {
      console.error("[email] Invitation email failed:", error);
      return;
    }
    console.log("[email] Invitation sent to", args.to, "id:", data?.id);
  },
});

// ─── Password reset email ────────────────────────────────

export const sendPasswordReset = internalAction({
  args: {
    to: v.string(),
    resetToken: v.string(),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();
    const appUrl = getAppUrl();
    const resetUrl = `${appUrl}/reset-password?token=${args.resetToken}`;

    const html = `
<!DOCTYPE html>
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
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">
        Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta.
      </p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475467;">
        Kliknij poniżej, aby ustawić nowe hasło:
      </p>
      <a href="${resetUrl}"
         style="display:inline-block;padding:12px 24px;background:#7f56d9;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">
        Ustaw nowe hasło
      </a>
      <p style="margin:32px 0 0;font-size:13px;color:#98a2b3;">
        Link jest ważny przez 1 godzinę. Jeśli nie prosiłeś o reset hasła, zignoruj tego maila.
      </p>
    </div>
    <div style="padding:20px 40px;background:#f9fafb;border-top:1px solid #eaecf0;">
      <p style="margin:0;font-size:12px;color:#98a2b3;">doseo — SEO monitoring & strategy platform</p>
    </div>
  </div>
</body>
</html>`;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: args.to,
      subject: "Reset hasła — doseo",
      html,
    });
    if (error) {
      console.error("[email] Password reset email failed:", error);
      return;
    }
    console.log("[email] Password reset sent to", args.to, "id:", data?.id);
  },
});

// ─── Subscription confirmation email ─────────────────────

export const sendSubscriptionConfirmation = internalAction({
  args: {
    to: v.string(),
    planName: v.string(),
    billingCycle: v.string(),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();
    const appUrl = getAppUrl();
    const cycleLabel = args.billingCycle === "yearly" ? "roczny" : "miesięczny";

    const html = `
<!DOCTYPE html>
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
        Plan <strong>${args.planName}</strong> (${cycleLabel}) został aktywowany. Masz teraz dostęp do wszystkich funkcji w ramach tego planu.
      </p>
      <a href="${appUrl}/settings"
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

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: args.to,
      subject: `Plan ${args.planName} aktywowany — doseo`,
      html,
    });
    if (error) {
      console.error("[email] Subscription email failed:", error);
      return;
    }
    console.log("[email] Subscription confirmation sent to", args.to, "id:", data?.id);
  },
});
