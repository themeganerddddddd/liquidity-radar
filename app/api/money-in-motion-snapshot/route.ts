import { NextResponse } from "next/server";
import { buildClientMotionSnapshot } from "../../../lib/client-motion-snapshot";
import { loadCurrentMotionSnapshot } from "../../../lib/server-motion-snapshot";

export async function GET(request?: Request) {
  const snapshot = await loadCurrentMotionSnapshot(request?.url);
  return NextResponse.json(buildClientMotionSnapshot(snapshot), {
    headers: {
      "cache-control":
        "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
