import { NextResponse } from "next/server";

export async function GET() {
  const startTime = Date.now();

  const health = {
    status: "healthy" as const,
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
    uptime: process.uptime(),
    responseTimeMs: Date.now() - startTime,
    services: {
      app: "up",
    },
  };

  return NextResponse.json(health, { status: 200 });
}

export const dynamic = "force-dynamic";
