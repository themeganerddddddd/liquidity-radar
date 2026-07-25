import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await env.DB.prepare("SELECT 1 AS ready").first();
    return NextResponse.json({
      status: "ready",
      dependencies: {
        database: "ready",
        object_storage: env.BUCKET ? "ready" : "unavailable",
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "not_ready", dependencies: { database: "unavailable" } },
      { status: 503 },
    );
  }
}
