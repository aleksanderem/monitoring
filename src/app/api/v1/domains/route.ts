import { NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  isApiKeyContext,
  checkScope,
  errorResponse,
} from "@/lib/api/middleware";

export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (!isApiKeyContext(auth)) return auth;

  if (!checkScope(auth, "domains:read")) {
    return errorResponse(
      "INSUFFICIENT_SCOPE",
      "The API key does not have the 'domains:read' scope.",
      403
    );
  }

  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 20)));

  // Placeholder data — will be replaced by ConvexHttpClient queries
  const placeholderDomains = [
    { id: "d_1", domain: "example.com", createdAt: "2025-01-15T10:00:00Z", keywordCount: 42 },
    { id: "d_2", domain: "mysite.org", createdAt: "2025-02-20T08:30:00Z", keywordCount: 18 },
  ];

  return NextResponse.json({
    data: placeholderDomains,
    meta: {
      total: placeholderDomains.length,
      page,
      limit,
    },
  });
}
