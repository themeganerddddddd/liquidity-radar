import { NextResponse } from "next/server";
import { loadCurrentMotionSnapshot } from "../../../../lib/server-motion-snapshot";

const DEMO_API_KEY = "lr_demo_local_2026";

export async function GET(request: Request) {
  const snapshot = await loadCurrentMotionSnapshot(request.url);
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (token !== DEMO_API_KEY) {
    return NextResponse.json(
      {
        error: {
          code: "unauthorized",
          message: "Provide a valid workspace API key as a Bearer token.",
          request_id: requestId,
        },
      },
      { status: 401, headers: { "x-request-id": requestId } },
    );
  }
  const url = new URL(request.url);
  const stage = url.searchParams.get("stage");
  const type = url.searchParams.get("type");
  const minimumConfidence = Number(
    url.searchParams.get("minimum_confidence") || 0,
  );
  const minimumAmount = Number(url.searchParams.get("minimum_amount") || 0);
  const maximumAmount = Number(url.searchParams.get("maximum_amount") || 0);
  const limit = Math.min(
    250,
    Math.max(1, Number(url.searchParams.get("limit") || 100)),
  );
  const records = snapshot.records
    .filter((record) => {
      const amount =
        record.estimate.potentiallyDeployableHigh ??
        record.reportedTransactionValue;
      return (
        (!stage || record.stage === stage) &&
        (!type || record.eventType === type) &&
        record.confidence.total >= minimumConfidence &&
        (!minimumAmount || (amount !== null && amount >= minimumAmount)) &&
        (!maximumAmount || (amount !== null && amount <= maximumAmount))
      );
    })
    .slice(0, limit);
  return NextResponse.json(
    {
      data: records,
      meta: {
        returned: records.length,
        available: snapshot.stats.records,
        generated_at: snapshot.generatedAt,
        schema_version: snapshot.schemaVersion,
      },
      disclaimer: snapshot.disclaimer,
      request_id: requestId,
    },
    {
      headers: {
        "x-request-id": requestId,
        "cache-control": "private, max-age=60",
      },
    },
  );
}
