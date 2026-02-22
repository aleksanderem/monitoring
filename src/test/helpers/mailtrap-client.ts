/**
 * Mailtrap Sandbox client for e2e email delivery verification.
 *
 * Two capabilities:
 * 1. Send emails via Mailtrap SMTP (deposits into sandbox inbox)
 * 2. Read emails via Mailtrap HTTP API (verify content arrived)
 *
 * Requires env vars:
 *   MAILTRAP_API_TOKEN    — HTTP API token
 *   MAILTRAP_ACCOUNT_ID   — Account ID
 *   MAILTRAP_INBOX_ID     — Sandbox inbox ID
 *   MAILTRAP_SMTP_USER    — SMTP username
 *   MAILTRAP_SMTP_PASS    — SMTP password
 */

import * as nodemailer from "nodemailer";

const BASE = "https://mailtrap.io/api";

function getConfig() {
  const token = process.env.MAILTRAP_API_TOKEN;
  const accountId = process.env.MAILTRAP_ACCOUNT_ID;
  if (!token || !accountId) {
    throw new Error("MAILTRAP_API_TOKEN and MAILTRAP_ACCOUNT_ID must be set");
  }
  return { token, accountId };
}

function headers() {
  const { token } = getConfig();
  return {
    "Api-Token": token,
    "Content-Type": "application/json",
  };
}

function accountUrl(path: string) {
  const { accountId } = getConfig();
  return `${BASE}/accounts/${accountId}${path}`;
}

export interface MailtrapMessage {
  id: number;
  inbox_id: number;
  subject: string;
  sent_at: string;
  from_email: string;
  from_name: string;
  to_email: string;
  to_name: string;
  html_body: string;
  text_body: string;
  created_at: string;
}

// ─── SMTP sending ────────────────────────────────────────

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const user = process.env.MAILTRAP_SMTP_USER;
  const pass = process.env.MAILTRAP_SMTP_PASS;
  if (!user || !pass) {
    throw new Error("MAILTRAP_SMTP_USER and MAILTRAP_SMTP_PASS must be set");
  }

  transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: { user, pass },
  });
  return transporter;
}

/** Send an email via Mailtrap SMTP (deposits into sandbox inbox). */
export async function sendViaSMTP(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<string> {
  const transport = getTransporter();
  const info = await transport.sendMail({
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
  return info.messageId;
}

// ─── HTTP API reading ────────────────────────────────────

/** List messages in an inbox. */
export async function getMessages(
  inboxId: string,
): Promise<MailtrapMessage[]> {
  const res = await fetch(accountUrl(`/inboxes/${inboxId}/messages`), {
    headers: headers(),
  });
  if (!res.ok) {
    throw new Error(`Mailtrap getMessages failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Get a single message by ID. */
export async function getMessage(
  inboxId: string,
  messageId: number,
): Promise<MailtrapMessage> {
  const res = await fetch(
    accountUrl(`/inboxes/${inboxId}/messages/${messageId}`),
    { headers: headers() },
  );
  if (!res.ok) {
    throw new Error(`Mailtrap getMessage failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Get the HTML body of a message. */
export async function getMessageHtml(
  inboxId: string,
  messageId: number,
): Promise<string> {
  const res = await fetch(
    accountUrl(`/inboxes/${inboxId}/messages/${messageId}/body.html`),
    { headers: headers() },
  );
  if (!res.ok) {
    throw new Error(`Mailtrap getMessageHtml failed: ${res.status} ${await res.text()}`);
  }
  return res.text();
}

/** Clean all messages in an inbox. */
export async function cleanInbox(inboxId: string): Promise<void> {
  const res = await fetch(accountUrl(`/inboxes/${inboxId}/clean`), {
    method: "PATCH",
    headers: headers(),
  });
  if (!res.ok) {
    throw new Error(`Mailtrap cleanInbox failed: ${res.status} ${await res.text()}`);
  }
}

/** Poll until a message matching the filter arrives. */
export async function waitForEmail(
  inboxId: string,
  filter: { subject?: string; to?: string },
  timeoutMs = 30_000,
  pollIntervalMs = 2_000,
): Promise<MailtrapMessage> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const messages = await getMessages(inboxId);

    const match = messages.find((m) => {
      if (filter.subject && !m.subject.includes(filter.subject)) return false;
      if (filter.to && m.to_email !== filter.to) return false;
      return true;
    });

    if (match) return match;

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(
    `Mailtrap: no email matching ${JSON.stringify(filter)} within ${timeoutMs}ms`,
  );
}
