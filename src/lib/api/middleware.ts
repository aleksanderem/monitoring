import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiKeyContext {
  organizationId: string;
  keyId: string;
  scopes: string[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

// ---------------------------------------------------------------------------
// Rate limiter — sliding window per API key (in-memory)
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per window

interface RateLimitEntry {
  timestamps: number[];
}

// Exported for testing; in production a shared store (Redis) would replace this.
export const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Returns true if the key is within its rate limit, false if over.
 * Mutates the store as a side-effect.
 */
export function checkRateLimit(apiKey: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(apiKey) ?? { timestamps: [] };

  // Evict timestamps outside the window
  entry.timestamps = entry.timestamps.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );

  if (entry.timestamps.length >= RATE_LIMIT_MAX) {
    rateLimitStore.set(apiKey, entry);
    return false;
  }

  entry.timestamps.push(now);
  rateLimitStore.set(apiKey, entry);
  return true;
}

// ---------------------------------------------------------------------------
// API key extraction & validation
// ---------------------------------------------------------------------------

const API_KEY_PREFIX = "dsk_";

function extractApiKey(request: Request): string | null {
  // 1. Check X-API-Key header
  const xApiKey = request.headers.get("x-api-key");
  if (xApiKey) return xApiKey;

  // 2. Check Authorization: Bearer <key>
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7).trim();
  }

  return null;
}

/**
 * Validate key format and return a context stub.
 *
 * In the real implementation this would query the Convex `userAPIKeys` table
 * via ConvexHttpClient to resolve the key to an organisation, verify it is not
 * revoked, and record `lastUsedAt`. For now we validate the prefix format and
 * return a deterministic stub derived from the key itself.
 */
function validateApiKey(key: string): ApiKeyContext | null {
  if (!key.startsWith(API_KEY_PREFIX) || key.length < 12) {
    return null;
  }

  // Derive a deterministic stub from the key — good enough for the scaffold.
  const hash = key.slice(4, 12);
  return {
    organizationId: `org_${hash}`,
    keyId: `key_${hash}`,
    scopes: ["domains:read", "keywords:read", "positions:read"],
  };
}

// ---------------------------------------------------------------------------
// Scope checking
// ---------------------------------------------------------------------------

export function checkScope(
  context: ApiKeyContext,
  requiredScope: string
): boolean {
  return context.scopes.includes(requiredScope);
}

// ---------------------------------------------------------------------------
// Standard error responses
// ---------------------------------------------------------------------------

export function errorResponse(
  code: string,
  message: string,
  status: number
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error: { code, message } },
    { status }
  );
}

// ---------------------------------------------------------------------------
// Main middleware — call at the top of each route handler
// ---------------------------------------------------------------------------

export function authenticateRequest(
  request: Request
): ApiKeyContext | NextResponse<ApiErrorBody> {
  const apiKey = extractApiKey(request);

  if (!apiKey) {
    return errorResponse(
      "MISSING_API_KEY",
      "Provide an API key via the X-API-Key header or Authorization: Bearer header.",
      401
    );
  }

  const context = validateApiKey(apiKey);
  if (!context) {
    return errorResponse(
      "INVALID_API_KEY",
      "The API key format is invalid. Keys must start with 'dsk_' and be at least 12 characters.",
      401
    );
  }

  if (!checkRateLimit(apiKey)) {
    return errorResponse(
      "RATE_LIMIT_EXCEEDED",
      "Rate limit exceeded. Maximum 100 requests per minute.",
      429
    );
  }

  return context;
}

/**
 * Type guard — returns true when `authenticateRequest` resolved to a valid context.
 */
export function isApiKeyContext(
  value: ApiKeyContext | NextResponse<ApiErrorBody>
): value is ApiKeyContext {
  return "organizationId" in value;
}
