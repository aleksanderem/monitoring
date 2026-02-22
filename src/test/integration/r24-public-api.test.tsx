import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import {
  authenticateRequest,
  isApiKeyContext,
  checkScope,
  checkRateLimit,
  rateLimitStore,
  errorResponse,
  type ApiKeyContext,
} from "@/lib/api/middleware";

// ---------------------------------------------------------------------------
// Helper: build a minimal Request object with optional headers
// ---------------------------------------------------------------------------

function makeRequest(headers: Record<string, string> = {}): Request {
  const h = new Headers(headers);
  return new Request("https://app.doseo.io/api/v1/domains", { headers: h });
}

// ---------------------------------------------------------------------------
// Middleware tests
// ---------------------------------------------------------------------------

describe("API middleware — authenticateRequest", () => {
  beforeEach(() => {
    rateLimitStore.clear();
  });

  it("rejects when no API key is provided", () => {
    const result = authenticateRequest(makeRequest());
    expect(isApiKeyContext(result)).toBe(false);
    // NextResponse — verify status via the response object
    const res = result as Response;
    expect(res.status).toBe(401);
  });

  it("rejects an API key with invalid prefix", () => {
    const result = authenticateRequest(
      makeRequest({ "x-api-key": "bad_key_value_here" })
    );
    expect(isApiKeyContext(result)).toBe(false);
    expect((result as Response).status).toBe(401);
  });

  it("rejects an API key that is too short", () => {
    const result = authenticateRequest(
      makeRequest({ "x-api-key": "dsk_short" })
    );
    expect(isApiKeyContext(result)).toBe(false);
    expect((result as Response).status).toBe(401);
  });

  it("accepts a valid dsk_ key from X-API-Key header", () => {
    const result = authenticateRequest(
      makeRequest({ "x-api-key": "dsk_abc123456789" })
    );
    expect(isApiKeyContext(result)).toBe(true);
    const ctx = result as ApiKeyContext;
    expect(ctx.organizationId).toMatch(/^org_/);
    expect(ctx.keyId).toMatch(/^key_/);
    expect(ctx.scopes).toContain("domains:read");
  });

  it("accepts a valid key from Authorization Bearer header", () => {
    const result = authenticateRequest(
      makeRequest({ authorization: "Bearer dsk_abc123456789" })
    );
    expect(isApiKeyContext(result)).toBe(true);
  });

  it("prefers X-API-Key over Authorization header", () => {
    const result = authenticateRequest(
      makeRequest({
        "x-api-key": "dsk_first_key_00",
        authorization: "Bearer dsk_second_key_0",
      })
    );
    expect(isApiKeyContext(result)).toBe(true);
    const ctx = result as ApiKeyContext;
    // The hash is derived from chars 4-12 of the key
    expect(ctx.organizationId).toBe("org_first_ke");
  });
});

// ---------------------------------------------------------------------------
// Scope checking
// ---------------------------------------------------------------------------

describe("API middleware — checkScope", () => {
  const ctx: ApiKeyContext = {
    organizationId: "org_test",
    keyId: "key_test",
    scopes: ["domains:read", "keywords:read"],
  };

  it("returns true when the scope is present", () => {
    expect(checkScope(ctx, "domains:read")).toBe(true);
  });

  it("returns false when the scope is missing", () => {
    expect(checkScope(ctx, "positions:write")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe("API middleware — rate limiting", () => {
  beforeEach(() => {
    rateLimitStore.clear();
  });

  it("allows requests within the limit", () => {
    for (let i = 0; i < 100; i++) {
      expect(checkRateLimit("dsk_test_key_01")).toBe(true);
    }
  });

  it("blocks the 101st request within the window", () => {
    for (let i = 0; i < 100; i++) {
      checkRateLimit("dsk_test_key_02");
    }
    expect(checkRateLimit("dsk_test_key_02")).toBe(false);
  });

  it("tracks limits independently per key", () => {
    for (let i = 0; i < 100; i++) {
      checkRateLimit("dsk_key_a_00001");
    }
    // key_a is exhausted, but key_b should still be fine
    expect(checkRateLimit("dsk_key_a_00001")).toBe(false);
    expect(checkRateLimit("dsk_key_b_00001")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Error response helper
// ---------------------------------------------------------------------------

describe("API middleware — errorResponse", () => {
  it("returns a JSON response with the correct structure and status", async () => {
    const res = errorResponse("TEST_ERROR", "Something failed", 422);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: "TEST_ERROR", message: "Something failed" },
    });
  });
});

// ---------------------------------------------------------------------------
// Route handler envelope structure (import handlers directly)
// ---------------------------------------------------------------------------

// We import the GET handlers and invoke them with crafted Request objects.

import { GET as getDomainsHandler } from "@/app/api/v1/domains/route";
import { GET as getKeywordsHandler } from "@/app/api/v1/domains/[domainId]/keywords/route";
import { GET as getPositionsHandler } from "@/app/api/v1/domains/[domainId]/positions/route";

function authedRequest(path: string): Request {
  return new Request(`https://app.doseo.io${path}`, {
    headers: { "x-api-key": "dsk_validkey1234" },
  });
}

describe("API routes — domains endpoint", () => {
  beforeEach(() => {
    rateLimitStore.clear();
  });

  it("returns correct JSON envelope with data and meta", async () => {
    const req = new (await import("next/server")).NextRequest(
      new URL("https://app.doseo.io/api/v1/domains?page=1&limit=10"),
      { headers: { "x-api-key": "dsk_validkey1234" } }
    );
    const res = await getDomainsHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("meta");
    expect(body.meta).toHaveProperty("total");
    expect(body.meta).toHaveProperty("page");
    expect(body.meta).toHaveProperty("limit");
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe("API routes — keywords endpoint", () => {
  beforeEach(() => {
    rateLimitStore.clear();
  });

  it("returns correct JSON envelope with data and meta", async () => {
    const req = new (await import("next/server")).NextRequest(
      new URL("https://app.doseo.io/api/v1/domains/d_1/keywords?page=1&limit=10"),
      { headers: { "x-api-key": "dsk_validkey1234" } }
    );
    const res = await getKeywordsHandler(req, {
      params: Promise.resolve({ domainId: "d_1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("meta");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0]).toHaveProperty("phrase");
    expect(body.data[0]).toHaveProperty("currentPosition");
  });
});

describe("API routes — positions endpoint", () => {
  beforeEach(() => {
    rateLimitStore.clear();
  });

  it("returns correct JSON envelope with data and meta", async () => {
    const req = new (await import("next/server")).NextRequest(
      new URL("https://app.doseo.io/api/v1/domains/d_1/positions?page=1&limit=10"),
      { headers: { "x-api-key": "dsk_validkey1234" } }
    );
    const res = await getPositionsHandler(req, {
      params: Promise.resolve({ domainId: "d_1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("meta");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0]).toHaveProperty("position");
    expect(body.data[0]).toHaveProperty("searchEngine");
  });
});

// ---------------------------------------------------------------------------
// API docs page rendering
// ---------------------------------------------------------------------------

import ApiDocsPage from "@/app/(public)/api-docs/page";

describe("API docs page", () => {
  it("renders the page title", () => {
    render(<ApiDocsPage />);
    expect(screen.getByText("API Documentation")).toBeInTheDocument();
  });

  it("renders the authentication section", () => {
    render(<ApiDocsPage />);
    expect(screen.getByText("Authentication")).toBeInTheDocument();
  });

  it("renders the endpoints section", () => {
    render(<ApiDocsPage />);
    expect(screen.getByText("Endpoints")).toBeInTheDocument();
  });

  it("renders the rate limits section", () => {
    render(<ApiDocsPage />);
    expect(screen.getByText("Rate Limits")).toBeInTheDocument();
  });

  it("renders the error format section", () => {
    render(<ApiDocsPage />);
    expect(screen.getByText("Error Format")).toBeInTheDocument();
  });
});
