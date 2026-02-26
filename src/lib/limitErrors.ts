export type LimitErrorType =
  | "cooldown"
  | "org_daily"
  | "user_daily"
  | "project_daily"
  | "domain_daily"
  | "bulk_cap";

export interface LimitError {
  type: LimitErrorType;
  waitMinutes?: number;
  limit?: number;
  count?: number;
}

/**
 * Parse a Convex error into a structured limit error.
 * Returns null if the error doesn't match any known limit pattern.
 *
 * Matches error messages thrown by convex/limits.ts:
 * - checkRefreshCooldown: "Please wait X min before refreshing/fetching..."
 * - checkDailyRefreshQuota: "Daily refresh limit reached (N/N)"
 * - checkPerUserDailyQuota: "Your daily refresh limit reached (N/N)"
 * - checkProjectDailyQuota: "Project daily refresh limit reached (N/N)"
 * - checkDomainDailyQuota: "Domain daily refresh limit reached (N/N)"
 * - checkBulkActionCap: "Maximum N keywords per bulk action (N selected)"
 */
export function parseLimitError(error: unknown): LimitError | null {
  const message = extractErrorMessage(error);
  if (!message) return null;

  // Cooldown: "Please wait X min before refreshing/fetching..."
  const cooldownMatch = message.match(
    /Please wait (\d+) min before (?:refreshing|fetching SERP)/
  );
  if (cooldownMatch) {
    return {
      type: "cooldown",
      waitMinutes: parseInt(cooldownMatch[1], 10),
    };
  }

  // Org daily: "Daily refresh limit reached (N/N)"
  if (/^Daily refresh limit reached/.test(message)) {
    const limitMatch = message.match(/\((\d+)\/(\d+)\)/);
    return {
      type: "org_daily",
      count: limitMatch ? parseInt(limitMatch[1], 10) : undefined,
      limit: limitMatch ? parseInt(limitMatch[2], 10) : undefined,
    };
  }

  // User daily: "Your daily refresh limit reached (N/N)"
  if (/^Your daily refresh limit reached/.test(message)) {
    const limitMatch = message.match(/\((\d+)\/(\d+)\)/);
    return {
      type: "user_daily",
      count: limitMatch ? parseInt(limitMatch[1], 10) : undefined,
      limit: limitMatch ? parseInt(limitMatch[2], 10) : undefined,
    };
  }

  // Project daily: "Project daily refresh limit reached (N/N)"
  if (/^Project daily refresh limit reached/.test(message)) {
    const limitMatch = message.match(/\((\d+)\/(\d+)\)/);
    return {
      type: "project_daily",
      count: limitMatch ? parseInt(limitMatch[1], 10) : undefined,
      limit: limitMatch ? parseInt(limitMatch[2], 10) : undefined,
    };
  }

  // Domain daily: "Domain daily refresh limit reached (N/N)"
  if (/^Domain daily refresh limit reached/.test(message)) {
    const limitMatch = message.match(/\((\d+)\/(\d+)\)/);
    return {
      type: "domain_daily",
      count: limitMatch ? parseInt(limitMatch[1], 10) : undefined,
      limit: limitMatch ? parseInt(limitMatch[2], 10) : undefined,
    };
  }

  // Bulk cap: "Maximum N keywords per bulk action (N selected)"
  const bulkMatch = message.match(
    /Maximum (\d+) keywords per bulk action \((\d+) selected\)/
  );
  if (bulkMatch) {
    return {
      type: "bulk_cap",
      limit: parseInt(bulkMatch[1], 10),
      count: parseInt(bulkMatch[2], 10),
    };
  }

  return null;
}

function extractErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error && typeof (error as any).message === "string") {
    return (error as any).message;
  }
  return null;
}
