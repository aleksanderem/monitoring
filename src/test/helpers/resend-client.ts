/**
 * Resend API client for e2e email verification.
 *
 * Requires env var: RESEND_API_KEY
 */

const BASE = "https://api.resend.com";

function getApiKey() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY must be set");
  return key;
}

function headers() {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
  };
}

export interface ResendEmailStatus {
  id: string;
  to: string[];
  from: string;
  subject: string;
  last_event: string;
  html: string;
  created_at: string;
}

/** Send an email via Resend API. Returns the email ID. */
export async function sendEmail(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<string> {
  const res = await fetch(`${BASE}/emails`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.id;
}

/** Get email status from Resend. */
export async function getEmail(emailId: string): Promise<ResendEmailStatus> {
  const res = await fetch(`${BASE}/emails/${emailId}`, {
    headers: headers(),
  });
  if (!res.ok) {
    throw new Error(`Resend getEmail failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Wait until the Resend email reaches a non-queued state.
 * Returns the final status.
 */
export async function waitForResendStatus(
  emailId: string,
  timeoutMs = 15_000,
  pollIntervalMs = 1_500,
): Promise<ResendEmailStatus> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const status = await getEmail(emailId);
    // "queued" means still processing. Wait for delivery, bounce, etc.
    if (status.last_event !== "queued") return status;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  // Return whatever we have even if still queued
  return getEmail(emailId);
}
