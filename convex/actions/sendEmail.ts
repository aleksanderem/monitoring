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

// ─── Password reset code email ──────────────────────────

export const sendPasswordResetCode = internalAction({
  args: {
    to: v.string(),
    code: v.string(),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();

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
      <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#475467;">
        Twój kod weryfikacyjny:
      </p>
      <div style="margin:16px 0 24px;padding:16px 24px;background:#f9fafb;border-radius:8px;border:1px solid #eaecf0;text-align:center;">
        <span style="font-size:32px;font-family:'Courier New',monospace;font-weight:700;letter-spacing:4px;color:#101828;">${args.code}</span>
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

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: args.to,
      subject: "Kod resetowania hasła — doseo",
      html,
    });
    if (error) {
      console.error("[email] Password reset code email failed:", error);
      return;
    }
    console.log("[email] Password reset code sent to", args.to, "id:", data?.id);
  },
});

// ─── Daily Digest email ─────────────────────────────────

export const sendDailyDigest = internalAction({
  args: {
    to: v.string(),
    userName: v.string(),
    domainName: v.string(),
    totalKeywords: v.number(),
    avgPosition: v.optional(v.number()),
    gainers: v.array(
      v.object({ phrase: v.string(), position: v.number(), change: v.number() })
    ),
    losers: v.array(
      v.object({ phrase: v.string(), position: v.number(), change: v.number() })
    ),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();
    const appUrl = getAppUrl();

    const avgPosDisplay =
      args.avgPosition != null ? String(args.avgPosition) : "—";

    const gainerRows = args.gainers.length
      ? args.gainers
          .map(
            (g) =>
              `<tr>
                <td style="padding:8px 12px;border-bottom:1px solid #eaecf0;font-size:14px;color:#101828;">${g.phrase}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #eaecf0;font-size:14px;color:#101828;text-align:center;">${g.position}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #eaecf0;font-size:14px;color:#16a34a;text-align:center;font-weight:600;">&#9650; ${Math.abs(g.change)}</td>
              </tr>`
          )
          .join("")
      : `<tr><td colspan="3" style="padding:12px;text-align:center;color:#98a2b3;font-size:14px;">Brak wzrostów w tym okresie</td></tr>`;

    const loserRows = args.losers.length
      ? args.losers
          .map(
            (l) =>
              `<tr>
                <td style="padding:8px 12px;border-bottom:1px solid #eaecf0;font-size:14px;color:#101828;">${l.phrase}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #eaecf0;font-size:14px;color:#101828;text-align:center;">${l.position}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #eaecf0;font-size:14px;color:#dc2626;text-align:center;font-weight:600;">&#9660; ${Math.abs(l.change)}</td>
              </tr>`
          )
          .join("")
      : `<tr><td colspan="3" style="padding:12px;text-align:center;color:#98a2b3;font-size:14px;">Brak spadków w tym okresie</td></tr>`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#7f56d9,#9b6dff);padding:32px 40px;">
      <h1 style="margin:0 0 4px;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
      <p style="margin:0;color:rgba(255,255,255,0.85);font-size:16px;">&#128202; Codzienny raport pozycji</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="margin:0 0 16px;font-size:15px;color:#475467;">Cześć, ${args.userName}! Oto podsumowanie pozycji dla <strong>${args.domainName}</strong>:</p>

      <div style="display:flex;gap:16px;margin:0 0 24px;">
        <div style="flex:1;background:#f9fafb;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#101828;">${args.totalKeywords}</div>
          <div style="font-size:12px;color:#98a2b3;margin-top:4px;">Monitorowanych</div>
        </div>
        <div style="flex:1;background:#f9fafb;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#101828;">${avgPosDisplay}</div>
          <div style="font-size:12px;color:#98a2b3;margin-top:4px;">Śr. pozycja</div>
        </div>
      </div>

      <h3 style="margin:0 0 8px;font-size:15px;color:#16a34a;">&#9650; Największe wzrosty</h3>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#98a2b3;font-weight:500;">Fraza</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#98a2b3;font-weight:500;">Pozycja</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#98a2b3;font-weight:500;">Zmiana</th>
          </tr>
        </thead>
        <tbody>${gainerRows}</tbody>
      </table>

      <h3 style="margin:0 0 8px;font-size:15px;color:#dc2626;">&#9660; Największe spadki</h3>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#98a2b3;font-weight:500;">Fraza</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#98a2b3;font-weight:500;">Pozycja</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#98a2b3;font-weight:500;">Zmiana</th>
          </tr>
        </thead>
        <tbody>${loserRows}</tbody>
      </table>

      <a href="${appUrl}/projects"
         style="display:inline-block;padding:12px 24px;background:#7f56d9;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">
        Przejdź do panelu
      </a>
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
      subject: `[doseo] Codzienny raport: ${args.domainName}`,
      html,
    });
    if (error) {
      console.error("[email] Daily digest failed:", error);
      throw new Error(`Daily digest send failed: ${error.message}`);
    }
    console.log("[email] Daily digest sent to", args.to, "id:", data?.id);
  },
});

// ─── Weekly Report email ────────────────────────────────

export const sendWeeklyReport = internalAction({
  args: {
    to: v.string(),
    userName: v.string(),
    domainName: v.string(),
    totalKeywords: v.number(),
    top3: v.number(),
    top10: v.number(),
    top20: v.number(),
    top50: v.number(),
    improved: v.number(),
    declined: v.number(),
    stable: v.number(),
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
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#16a34a,#22c55e);padding:32px 40px;">
      <h1 style="margin:0 0 4px;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
      <p style="margin:0;color:rgba(255,255,255,0.85);font-size:16px;">&#128200; Tygodniowy raport SEO</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="margin:0 0 16px;font-size:15px;color:#475467;">Cześć, ${args.userName}! Oto tygodniowe podsumowanie dla <strong>${args.domainName}</strong>:</p>

      <h3 style="margin:0 0 12px;font-size:15px;color:#101828;">Dystrybucja pozycji</h3>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#98a2b3;font-weight:500;">Zakres</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#98a2b3;font-weight:500;">Liczba słów</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eaecf0;font-size:14px;color:#101828;">Top 3</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eaecf0;font-size:14px;color:#101828;text-align:center;font-weight:600;">${args.top3}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eaecf0;font-size:14px;color:#101828;">Top 10</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eaecf0;font-size:14px;color:#101828;text-align:center;font-weight:600;">${args.top10}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eaecf0;font-size:14px;color:#101828;">Top 20</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eaecf0;font-size:14px;color:#101828;text-align:center;font-weight:600;">${args.top20}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eaecf0;font-size:14px;color:#101828;">Top 50</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eaecf0;font-size:14px;color:#101828;text-align:center;font-weight:600;">${args.top50}</td>
          </tr>
        </tbody>
      </table>

      <h3 style="margin:0 0 12px;font-size:15px;color:#101828;">Zmiany pozycji</h3>
      <div style="display:flex;gap:12px;margin:0 0 24px;">
        <div style="flex:1;background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#16a34a;">${args.improved}</div>
          <div style="font-size:12px;color:#16a34a;margin-top:4px;">Wzrosty</div>
        </div>
        <div style="flex:1;background:#fef2f2;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#dc2626;">${args.declined}</div>
          <div style="font-size:12px;color:#dc2626;margin-top:4px;">Spadki</div>
        </div>
        <div style="flex:1;background:#f9fafb;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#475467;">${args.stable}</div>
          <div style="font-size:12px;color:#475467;margin-top:4px;">Bez zmian</div>
        </div>
      </div>

      <p style="margin:0 0 16px;font-size:14px;color:#98a2b3;">Łącznie monitorowanych słów kluczowych: <strong style="color:#101828;">${args.totalKeywords}</strong></p>

      <a href="${appUrl}/projects"
         style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">
        Przejdź do panelu
      </a>
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
      subject: `[doseo] Tygodniowy raport: ${args.domainName}`,
      html,
    });
    if (error) {
      console.error("[email] Weekly report failed:", error);
      throw new Error(`Weekly report send failed: ${error.message}`);
    }
    console.log("[email] Weekly report sent to", args.to, "id:", data?.id);
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

// ─── Payment failed notice ──────────────────────────────

export const sendPaymentFailedNotice = internalAction({
  args: {
    to: v.string(),
    orgName: v.string(),
    portalUrl: v.string(),
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
    <div style="background:#dc2626;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Płatność nie powiodła się</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">
        Nie udało się pobrać płatności za subskrypcję organizacji <strong>${args.orgName}</strong>.
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">
        Masz <strong>7 dni</strong> na zaktualizowanie metody płatności. Po tym czasie Twoje konto zostanie przełączone w tryb tylko do odczytu.
      </p>
      <a href="${args.portalUrl}"
         style="display:inline-block;padding:12px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">
        Zaktualizuj metodę płatności
      </a>
      <p style="margin:32px 0 0;font-size:13px;color:#98a2b3;">
        Jeśli masz pytania, odpowiedz na tego maila.
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
      subject: "Płatność nie powiodła się — doseo",
      html,
    });
    if (error) {
      console.error("[email] Payment failed notice failed:", error);
      return;
    }
    console.log("[email] Payment failed notice sent to", args.to, "id:", data?.id);
  },
});

// ─── Trial reminder email ───────────────────────────────

export const sendTrialReminder = internalAction({
  args: {
    to: v.string(),
    orgName: v.string(),
    daysLeft: v.number(),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();
    const appUrl = getAppUrl();
    const daysLabel = args.daysLeft === 1 ? "1 dzień" : `${args.daysLeft} dni`;

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
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Trial kończy się za ${daysLabel}</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">
        Twój okres próbny planu Pro dla organizacji <strong>${args.orgName}</strong> kończy się za <strong>${daysLabel}</strong>.
      </p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475467;">
        Aby zachować dostęp do wszystkich funkcji Pro, upewnij się że masz dodaną metodę płatności. Jeśli nie chcesz kontynuować, Twoje konto zostanie automatycznie przełączone na plan Free.
      </p>
      <a href="${appUrl}/settings?tab=plan"
         style="display:inline-block;padding:12px 24px;background:#7f56d9;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">
        Zarządzaj subskrypcją
      </a>
      <p style="margin:32px 0 0;font-size:13px;color:#98a2b3;">
        Jeśli masz pytania dotyczące planu, odpowiedz na tego maila.
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
      subject: `Trial kończy się za ${daysLabel} — doseo`,
      html,
    });
    if (error) {
      console.error("[email] Trial reminder failed:", error);
      return;
    }
    console.log("[email] Trial reminder sent to", args.to, "id:", data?.id);
  },
});

// ─── Cancellation confirmation email ────────────────────

export const sendCancellationConfirmation = internalAction({
  args: {
    to: v.string(),
    orgName: v.string(),
    planName: v.string(),
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
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Subskrypcja anulowana</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">
        Plan <strong>${args.planName}</strong> dla organizacji <strong>${args.orgName}</strong> został anulowany.
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">
        Twoje konto zostało przełączone na plan Free. Wszystkie Twoje dane zostały zachowane — możesz je przeglądać, ale dodawanie nowych zasobów powyżej limitów planu Free nie będzie możliwe.
      </p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475467;">
        Możesz w każdej chwili ponownie aktywować subskrypcję:
      </p>
      <a href="${appUrl}/pricing"
         style="display:inline-block;padding:12px 24px;background:#7f56d9;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">
        Ponownie aktywuj plan
      </a>
      <p style="margin:32px 0 0;font-size:13px;color:#98a2b3;">
        Dziękujemy za korzystanie z doseo. Jeśli masz uwagi, chętnie je poznamy.
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
      subject: `Subskrypcja anulowana — doseo`,
      html,
    });
    if (error) {
      console.error("[email] Cancellation email failed:", error);
      return;
    }
    console.log("[email] Cancellation confirmation sent to", args.to, "id:", data?.id);
  },
});

// ─── Degradation notice email ───────────────────────────

export const sendDegradationNotice = internalAction({
  args: {
    to: v.string(),
    orgName: v.string(),
    portalUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#dc2626;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Konto w trybie tylko do odczytu</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">
        Okres karencji dla organizacji <strong>${args.orgName}</strong> minął, a płatność nadal nie została pobrana.
      </p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475467;">
        Twoje konto zostało przełączone w tryb tylko do odczytu. Aby przywrócić pełny dostęp, zaktualizuj metodę płatności:
      </p>
      <a href="${args.portalUrl}"
         style="display:inline-block;padding:12px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">
        Zaktualizuj metodę płatności
      </a>
      <p style="margin:32px 0 0;font-size:13px;color:#98a2b3;">
        Twoje dane nie zostały usunięte. Po uregulowaniu płatności wszystko wróci do normy.
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
      subject: "Konto w trybie tylko do odczytu — doseo",
      html,
    });
    if (error) {
      console.error("[email] Degradation notice failed:", error);
      return;
    }
    console.log("[email] Degradation notice sent to", args.to, "id:", data?.id);
  },
});

// ─── Position Drop Alert ─────────────────────────────────

export const sendPositionDropAlert = internalAction({
  args: {
    to: v.string(),
    domainName: v.string(),
    keywordPhrase: v.string(),
    previousPosition: v.number(),
    currentPosition: v.number(),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();
    const appUrl = getAppUrl();
    const drop = args.previousPosition - args.currentPosition;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#dc2626;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Spadek pozycji: ${args.keywordPhrase}</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">
        Fraza <strong>"${args.keywordPhrase}"</strong> dla domeny <strong>${args.domainName}</strong> spadła o <strong>${Math.abs(drop)} pozycji</strong>.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
        <tr>
          <td style="padding:12px 16px;background:#fef2f2;border-radius:8px 0 0 8px;font-size:14px;color:#991b1b;">Poprzednia: <strong>${args.previousPosition}</strong></td>
          <td style="padding:12px 16px;background:#fef2f2;border-radius:0 8px 8px 0;font-size:14px;color:#991b1b;">Obecna: <strong>${args.currentPosition}</strong></td>
        </tr>
      </table>
      <a href="${appUrl}" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">Sprawdź szczegóły</a>
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
      subject: `Spadek pozycji: "${args.keywordPhrase}" — doseo`,
      html,
    });
    if (error) { console.error("[email] Position drop alert failed:", error); return; }
    console.log("[email] Position drop alert sent to", args.to, "id:", data?.id);
  },
});

// ─── Top N Exit Alert ────────────────────────────────────

export const sendTopNExitAlert = internalAction({
  args: {
    to: v.string(),
    domainName: v.string(),
    keywordPhrase: v.string(),
    previousPosition: v.number(),
    currentPosition: v.number(),
    topN: v.number(),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();
    const appUrl = getAppUrl();

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#f59e0b;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Wypadnięcie z Top ${args.topN}</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">
        Fraza <strong>"${args.keywordPhrase}"</strong> dla domeny <strong>${args.domainName}</strong> wypadła z Top ${args.topN}.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
        <tr>
          <td style="padding:12px 16px;background:#fffbeb;border-radius:8px 0 0 8px;font-size:14px;color:#92400e;">Poprzednia: <strong>${args.previousPosition}</strong></td>
          <td style="padding:12px 16px;background:#fffbeb;border-radius:0 8px 8px 0;font-size:14px;color:#92400e;">Obecna: <strong>${args.currentPosition}</strong></td>
        </tr>
      </table>
      <a href="${appUrl}" style="display:inline-block;padding:12px 24px;background:#f59e0b;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">Sprawdź szczegóły</a>
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
      subject: `Wypadnięcie z Top ${args.topN}: "${args.keywordPhrase}" — doseo`,
      html,
    });
    if (error) { console.error("[email] Top N exit alert failed:", error); return; }
    console.log("[email] Top N exit alert sent to", args.to, "id:", data?.id);
  },
});

// ─── New Competitor Alert ────────────────────────────────

export const sendNewCompetitorAlert = internalAction({
  args: {
    to: v.string(),
    domainName: v.string(),
    competitorDomain: v.string(),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();
    const appUrl = getAppUrl();

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#2563eb;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Nowy konkurent w SERP</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">
        Nowa domena <strong>${args.competitorDomain}</strong> pojawiła się w Top 10 wyników dla fraz monitorowanych na <strong>${args.domainName}</strong>.
      </p>
      <a href="${appUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">Sprawdź szczegóły</a>
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
      subject: `Nowy konkurent: ${args.competitorDomain} — doseo`,
      html,
    });
    if (error) { console.error("[email] New competitor alert failed:", error); return; }
    console.log("[email] New competitor alert sent to", args.to, "id:", data?.id);
  },
});

// ─── Backlink Lost Alert ─────────────────────────────────

export const sendBacklinkLostAlert = internalAction({
  args: {
    to: v.string(),
    domainName: v.string(),
    lostCount: v.number(),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();
    const appUrl = getAppUrl();

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#dc2626;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Utrata backlinków</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">
        Domena <strong>${args.domainName}</strong> straciła <strong>${args.lostCount}</strong> backlinków w ostatnim okresie.
      </p>
      <a href="${appUrl}" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">Sprawdź szczegóły</a>
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
      subject: `Utrata backlinków: ${args.domainName} — doseo`,
      html,
    });
    if (error) { console.error("[email] Backlink lost alert failed:", error); return; }
    console.log("[email] Backlink lost alert sent to", args.to, "id:", data?.id);
  },
});

// ─── Visibility Drop Alert ───────────────────────────────

export const sendVisibilityDropAlert = internalAction({
  args: {
    to: v.string(),
    domainName: v.string(),
    previousValue: v.number(),
    currentValue: v.number(),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();
    const appUrl = getAppUrl();
    const dropPct = Math.round(((args.previousValue - args.currentValue) / args.previousValue) * 100);

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#dc2626;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;">doseo</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#101828;">Spadek widoczności: -${dropPct}%</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">
        Widoczność domeny <strong>${args.domainName}</strong> spadła o <strong>${dropPct}%</strong>.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
        <tr>
          <td style="padding:12px 16px;background:#fef2f2;border-radius:8px 0 0 8px;font-size:14px;color:#991b1b;">Poprzednia: <strong>${args.previousValue}</strong></td>
          <td style="padding:12px 16px;background:#fef2f2;border-radius:0 8px 8px 0;font-size:14px;color:#991b1b;">Obecna: <strong>${args.currentValue}</strong></td>
        </tr>
      </table>
      <a href="${appUrl}" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">Sprawdź szczegóły</a>
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
      subject: `Spadek widoczności: ${args.domainName} (-${dropPct}%) — doseo`,
      html,
    });
    if (error) { console.error("[email] Visibility drop alert failed:", error); return; }
    console.log("[email] Visibility drop alert sent to", args.to, "id:", data?.id);
  },
});
