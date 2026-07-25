import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "healthy",
    service: "liquidity-radar-web",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
}
