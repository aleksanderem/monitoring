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
