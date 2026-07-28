import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ready",
    dependencies: {
      official_snapshot: "ready",
      sec_live_feed: process.env.SEC_USER_AGENT ? "configured" : "snapshot",
      account_database: "not_configured",
    },
    timestamp: new Date().toISOString(),
  });
}
