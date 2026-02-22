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

  if (!checkScope(auth, "positions:read")) {
    return errorResponse(
      "INSUFFICIENT_SCOPE",
      "The API key does not have the 'positions:read' scope.",
      403
    );
  }

  const { domainId } = await params;
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 20)));

  // Placeholder data
  const placeholderPositions = [
    {
      id: "pos_1",
      domainId,
      keyword: "best seo tools",
      position: 5,
      url: "https://example.com/seo-tools",
      checkedAt: "2025-03-01T12:00:00Z",
      searchEngine: "google",
      location: "United States",
    },
    {
      id: "pos_2",
      domainId,
      keyword: "keyword tracker",
      position: 12,
      url: "https://example.com/tracker",
      checkedAt: "2025-03-01T12:00:00Z",
      searchEngine: "google",
      location: "United States",
    },
  ];

  return NextResponse.json({
    data: placeholderPositions,
    meta: {
      total: placeholderPositions.length,
      page,
      limit,
    },
  });
}
