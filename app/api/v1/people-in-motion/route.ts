import { NextResponse } from "next/server";
import { loadCurrentMotionSnapshot } from "../../../../lib/server-motion-snapshot";

const DEMO_API_KEY = "lr_demo_local_2026";
export async function GET(request: Request) {
  const snapshot = await loadCurrentMotionSnapshot();
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
  const query = (url.searchParams.get("q") || "").trim().toLowerCase();
  const marketClass = url.searchParams.get("market_class") || "";
  const location = url.searchParams.get("location") || "";
  const industry = url.searchParams.get("industry") || "";
  const stage = url.searchParams.get("stage") || "";
  const eventType = url.searchParams.get("event_type") || "";
  const source = url.searchParams.get("source") || "";
  const minimumAmount = Number(url.searchParams.get("minimum_amount") || 0);
  const minimumConfidence = Number(
    url.searchParams.get("minimum_confidence") || 0,
  );
  const dateWindowDays = Number(url.searchParams.get("date_window_days") || 0);
  const ownershipOnly = url.searchParams.get("ownership_evidence") === "true";
  const sort = url.searchParams.get("sort") || "actionability";
  const limit = Math.min(
    250,
    Math.max(1, Number(url.searchParams.get("limit") || 100)),
  );
  const recordsById = new Map(
    snapshot.records.map((record) => [record.id, record]),
  );
  const threshold = dateWindowDays
    ? Date.parse(snapshot.generatedAt) - dateWindowDays * 86_400_000
    : 0;
  const people = snapshot.peopleInMotion
    .filter((person) => {
      const record = recordsById.get(person.latestEventId);
      const eventTime = Date.parse(
        `${person.latestSignalAt.slice(0, 10)}T00:00:00Z`,
      );
      return (
        (!query ||
          [
            person.name,
            person.company,
            person.role,
            person.industry,
            person.latestEventTitle,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)) &&
        (!marketClass || person.marketClass === marketClass) &&
        (!location ||
          [person.location.state, person.location.country].includes(
            location,
          )) &&
        (!industry || person.industry === industry) &&
        (!stage || person.latestStage === stage) &&
        (!eventType || record?.eventType === eventType) &&
        (!source ||
          person.evidence.some((evidence) => evidence.sourceId === source)) &&
        (!minimumAmount ||
          (person.estimatedLiquidityHigh !== null &&
            person.estimatedLiquidityHigh >= minimumAmount)) &&
        person.highestConfidence >= minimumConfidence &&
        (!threshold ||
          (Number.isFinite(eventTime) && eventTime >= threshold)) &&
        (!ownershipOnly || record?.ownershipEvidence === true)
      );
    })
    .sort((left, right) => {
      if (sort === "amount")
        return (
          (right.estimatedLiquidityHigh || 0) -
          (left.estimatedLiquidityHigh || 0)
        );
      if (sort === "recent")
        return right.latestSignalAt.localeCompare(left.latestSignalAt);
      if (sort === "confidence")
        return right.highestConfidence - left.highestConfidence;
      if (sort === "lead")
        return (right.leadDaysToClose || -1) - (left.leadDaysToClose || -1);
      return right.actionability.total - left.actionability.total;
    });

  return NextResponse.json(
    {
      data: people.slice(0, limit),
      meta: {
        returned: Math.min(people.length, limit),
        matched: people.length,
        available: snapshot.peopleInMotion.length,
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
