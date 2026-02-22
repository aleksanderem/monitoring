import { NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  isApiKeyContext,
  checkScope,
  errorResponse,
} from "@/lib/api/middleware";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ domainId: string }> }
) {
  const auth = authenticateRequest(request);
  if (!isApiKeyContext(auth)) return auth;

  if (!checkScope(auth, "keywords:read")) {
    return errorResponse(
      "INSUFFICIENT_SCOPE",
      "The API key does not have the 'keywords:read' scope.",
      403
    );
  }

  const { domainId } = await params;
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 20)));

  // Placeholder data
  const placeholderKeywords = [
    {
      id: "kw_1",
      domainId,
      phrase: "best seo tools",
      currentPosition: 5,
      previousPosition: 8,
      change: 3,
      url: "https://example.com/seo-tools",
      updatedAt: "2025-03-01T12:00:00Z",
    },
    {
      id: "kw_2",
      domainId,
      phrase: "keyword tracker",
      currentPosition: 12,
      previousPosition: 15,
      change: 3,
      url: "https://example.com/tracker",
      updatedAt: "2025-03-01T12:00:00Z",
    },
  ];

  return NextResponse.json({
    data: placeholderKeywords,
    meta: {
      total: placeholderKeywords.length,
      page,
      limit,
    },
  });
}
