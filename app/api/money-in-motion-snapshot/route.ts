import { NextResponse } from "next/server";
import { loadCurrentMotionSnapshot } from "../../../lib/server-motion-snapshot";

export async function GET() {
  const snapshot = await loadCurrentMotionSnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      "cache-control":
        "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
